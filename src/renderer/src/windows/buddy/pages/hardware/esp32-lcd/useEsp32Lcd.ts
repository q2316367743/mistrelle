/**
 * ESP32 LCD 配置状态（模块级单例）：配置经 IPC 读写（main 持有文件并归一化），
 * 即改即存（整份提交），保存后以 main 回读为准（失败自动回滚 UI）。
 * 连接编排/lastPort 记忆都在 main（esp32LcdService），渲染层只发指令与展示运行态；
 * 事件流由 main 推送。额度快照是独立公共域（见 pages/plugins/quota/useQuota）。
 */
import type { BuddyEventState, Esp32LcdConfig } from '@common/types/esp32Lcd'
import { MessageUtil } from '@/utils/modal'

const config = ref<Esp32LcdConfig | null>(null)
const saving = ref(false)
/** 连接运行态（main 推送；渲染层纯展示） */
const connectedPath = ref<string | null>(null)
const lastEvent = ref<BuddyEventState | null>(null)

let initialized = false

/** 以 main 为准回读整份配置 */
async function reload(): Promise<void> {
  config.value = await window.preload.esp32Lcd.getConfig()
}

/** 保存整份配置（无论成败都回读，UI 始终与 main 对齐） */
async function save(next: Esp32LcdConfig): Promise<void> {
  saving.value = true
  try {
    const result = await window.preload.esp32Lcd.saveConfig(next)
    if (!result.ok) MessageUtil.error(result.msg || '保存失败')
  } catch (e) {
    MessageUtil.error('保存失败：' + (e as Error).message)
  } finally {
    await reload()
    saving.value = false
  }
}

/** 局部更新：与当前配置合并后整份提交 */
async function patch(part: Partial<Esp32LcdConfig>): Promise<void> {
  if (!config.value) return
  await save({ ...config.value, ...part })
}

/** 连接串口（指令发往 main；成功即记忆 lastPort/baudRate，失败 toast 原因） */
async function connect(path: string, baudRate?: number): Promise<void> {
  const result = await window.preload.esp32Lcd.connect(path, baudRate)
  if (!result.ok) MessageUtil.error(result.msg || '串口连接失败')
}

/** 断开当前连接（指令发往 main，运行态随推送同步） */
function disconnect(): Promise<void> {
  return window.preload.esp32Lcd.disconnect()
}

export function useEsp32Lcd() {
  if (!initialized) {
    initialized = true
    void reload()
    // 完整运行态（连接 + 最近事件）：先拉一次再订阅推送
    void window.preload.esp32Lcd.getState().then((state) => {
      connectedPath.value = state.connectedPath
      lastEvent.value = state.lastEvent
    })
    let prev: string | null = null
    window.preload.esp32Lcd.onState((state) => {
      connectedPath.value = state.connectedPath
      if (prev && !state.connectedPath) MessageUtil.warning('串口连接已断开')
      prev = state.connectedPath
    })
    window.preload.esp32Lcd.onEvent((state) => {
      lastEvent.value = state
    })
  }
  return {
    config,
    saving,
    connectedPath,
    lastEvent,
    reload,
    patch,
    save,
    connect,
    disconnect
  }
}
