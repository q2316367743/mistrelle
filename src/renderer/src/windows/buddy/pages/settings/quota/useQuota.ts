/**
 * 额度插件域状态（模块级单例，公共域）：配置/插件/快照经 quota 域 IPC 读写（main 持有并归一化），
 * 即改即存（整份提交），保存后以 main 回读为准（失败自动回滚 UI）；
 * 额度是独立公共域（不依附任何设备），ESP32 LCD 等硬件页面也复用本 composable 展示快照。
 */
import type { QuotaConfig, QuotaPluginDescriptor, QuotaSnapshot } from '@common/types/quota'
import { MessageUtil } from '@/utils/modal'

const config = ref<QuotaConfig | null>(null)
const saving = ref(false)
/** 额度插件列表（内置预置 + 插件目录第三方，统一模型） */
const plugins = ref<QuotaPluginDescriptor[]>([])
const loadingPlugins = ref(false)
const lastQuota = ref<QuotaSnapshot | null>(null)
const refreshing = ref(false)

let initialized = false

/** 以 main 为准回读整份配置 */
async function reload(): Promise<void> {
  config.value = await window.preload.quota.getConfig()
}

/** 保存整份配置（无论成败都回读，UI 始终与 main 对齐） */
async function save(next: QuotaConfig): Promise<void> {
  saving.value = true
  try {
    // config 是 ref 深层 reactive 对象，浅展开后嵌套子对象仍是 Proxy——
    // Proxy 无法跨 contextBridge 结构化克隆（报 An object could not be cloned），跨桥前 JSON 深拷贝
    const payload = JSON.parse(JSON.stringify(next)) as QuotaConfig
    const result = await window.preload.quota.saveConfig(payload)
    if (!result.ok) MessageUtil.error(result.msg || '保存失败')
  } catch (e) {
    MessageUtil.error('保存失败：' + (e as Error).message)
  } finally {
    await reload()
    saving.value = false
  }
}

/** 局部更新：与当前配置合并后整份提交 */
async function patch(part: Partial<QuotaConfig>): Promise<void> {
  if (!config.value) return
  await save({ ...config.value, ...part })
}

/** 重新扫描插件列表（内置 + 目录第三方；第三方替换文件后点此生效） */
async function refreshPlugins(): Promise<void> {
  loadingPlugins.value = true
  try {
    plugins.value = await window.preload.quota.listPlugins()
  } catch (e) {
    MessageUtil.error('获取插件列表失败：' + (e as Error).message)
  } finally {
    loadingPlugins.value = false
  }
}

/** 在系统文件管理器中打开插件目录（安装第三方插件 = 把 .js 放进去） */
function openPluginsDir(): Promise<void> {
  return window.preload.quota.openPluginsDir()
}

/** 立即刷新额度（快照同时经 main 推送与设备总线分发） */
async function runQuotaNow(): Promise<void> {
  refreshing.value = true
  try {
    lastQuota.value = await window.preload.quota.runNow()
  } catch (e) {
    MessageUtil.error('额度刷新失败：' + (e as Error).message)
  } finally {
    refreshing.value = false
  }
}

export function useQuota() {
  if (!initialized) {
    initialized = true
    void reload()
    void refreshPlugins()
    void window.preload.quota.getLastSnapshot().then((snapshot) => {
      if (snapshot) lastQuota.value = snapshot
    })
    window.preload.quota.onSnapshot((snapshot) => {
      lastQuota.value = snapshot
    })
  }
  return {
    config,
    saving,
    plugins,
    loadingPlugins,
    lastQuota,
    refreshing,
    reload,
    patch,
    save,
    refreshPlugins,
    openPluginsDir,
    runQuotaNow
  }
}
