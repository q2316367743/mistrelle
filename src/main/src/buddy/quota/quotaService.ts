/**
 * 额度刷新服务（main 进程，模块级单例，独立公共域）：按配置间隔执行启用的额度插件
 * （内置预置 + 插件目录第三方，统一模型、内置同样可关闭），汇总快照后：
 * ① 推送渲染层（quota:snapshot）；② 经 quotaBus 发布给订阅设备（ESP32 LCD 等自行下发）。
 * 本域不感知任何设备与串口——依赖方向：设备域订阅 quotaBus，单向无回环。
 */
import { BrowserWindow } from 'electron'
import { QuotaChannels } from '@common/buddy/quota/quotaChannels'
import type { QuotaConfig, QuotaSaveResult, QuotaSnapshot } from '@common/types/quota'
import { BUILTIN_QUOTA_PLUGINS } from './builtinPlugins'
import { defaultQuotaConfig, loadQuotaConfig, normalizeQuotaConfig, saveQuotaConfigFile } from './quotaConfig'
import { readPluginCode } from './externalPlugins'
import { publishQuotaSnapshot } from './quotaBus'
import { runQuotaScript, type QuotaPluginResult } from './quotaRunner'

// 声明即给默认值：init 前后的任何调用时序都安全
let config: QuotaConfig = defaultQuotaConfig()
let timer: ReturnType<typeof setInterval> | null = null
/** 最近一次快照（渲染层 getLastSnapshot 首拉） */
let lastSnapshot: QuotaSnapshot | null = null

function broadcastSnapshot(snapshot: QuotaSnapshot): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(QuotaChannels.snapshot, snapshot)
  }
}

/** 启动初始化（main 启动即执行，不依赖渲染层）：加载配置 + 恢复上次快照 + 启动刷新定时器 */
export function initQuota(): void {
  config = loadQuotaConfig()
  // 恢复上次快照（持久化在 quota.json）：渲染层首拉与订阅设备（LCD 等）启动即有数据，不等首轮刷新
  if (config.lastSnapshot) {
    lastSnapshot = config.lastSnapshot
    broadcastSnapshot(lastSnapshot)
    void publishQuotaSnapshot(lastSnapshot)
  }
  scheduleQuotaTimer(config.intervalMinutes)
}

/** 读取整份配置 */
export function getQuotaConfig(): QuotaConfig {
  return config
}

/** 保存整份配置：归一化落盘，刷新定时器随间隔变化重启；快照以内存值为准（渲染层回存的可能已过期） */
export function saveQuotaConfig(raw: unknown): QuotaSaveResult {
  config = normalizeQuotaConfig(raw)
  config.lastSnapshot = lastSnapshot
  saveQuotaConfigFile(config)
  scheduleQuotaTimer(config.intervalMinutes)
  return { ok: true }
}

/** 读取最近一次快照 */
export function getLastQuotaSnapshot(): QuotaSnapshot | null {
  return lastSnapshot
}

/** 按配置间隔（重）启自动刷新定时器 */
function scheduleQuotaTimer(intervalMinutes: number): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  timer = setInterval(() => void runQuotaNow(), intervalMinutes * 60_000)
}

/** 立即刷新：执行启用的插件 → 汇总快照 → 推送渲染层 + 总线分发设备。无可用插件时返回带 error 的空快照 */
export async function runQuotaNow(): Promise<QuotaSnapshot> {
  /** 每个启用插件一个 job，键用于给快照条目标注来源 */
  const jobs: Array<{ key: string; promise: Promise<QuotaPluginResult> }> = []

  // 内置预置（可关闭；enabled 才执行）
  for (const plugin of BUILTIN_QUOTA_PLUGINS) {
    const cfg = config.builtin[plugin.key]
    if (!cfg?.enabled) continue
    jobs.push({ key: plugin.key, promise: runQuotaScript(plugin.code, cfg.settings) })
  }
  // 插件目录第三方（文件替换即更新，执行时读取最新内容）
  for (const [file, cfg] of Object.entries(config.external)) {
    if (!cfg.enabled) continue
    jobs.push({
      key: file,
      promise: runQuotaScript(readPluginCode(file), cfg.settings).catch((e: unknown) => {
        throw new Error(`${file}：${(e as Error).message}`)
      })
    })
  }

  const snapshot: QuotaSnapshot = { items: [], at: Date.now() }
  if (!jobs.length) {
    snapshot.error = '未启用任何额度插件'
  } else {
    const errors: string[] = []
    const results = await Promise.allSettled(jobs.map((job) => job.promise))
    jobs.forEach((job, index) => {
      const result = results[index]
      if (result.status === 'fulfilled') {
        // 每条快照条目带来源插件键：屏幕类设备按各自配置（esp32Lcd screenQuota）挑选上屏条目
        snapshot.items.push(...result.value.items.map((item) => ({ ...item, pluginKey: job.key })))
      } else {
        errors.push((result.reason as Error)?.message ?? String(result.reason))
      }
    })
    if (errors.length) snapshot.error = errors.join('；')
  }
  lastSnapshot = snapshot
  config.lastSnapshot = snapshot
  persistConfigQuietly()
  broadcastSnapshot(snapshot)
  await publishQuotaSnapshot(snapshot)
  return snapshot
}

/** 配置落盘（含最新快照）：失败只记日志，不影响刷新主流程 */
function persistConfigQuietly(): void {
  try {
    saveQuotaConfigFile(config)
  } catch (error) {
    console.error('[quota] 配置落盘失败', error)
  }
}
