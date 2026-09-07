/**
 * 红绿灯配置状态（模块级单例）：配置经 IPC 读写（main 持有文件并校验），
 * 即改即存，保存后以 main 回读为准（失败自动回滚 UI）。
 * 连接编排/lastPort 记忆都在 main（TrafficLightService），渲染层只发指令与展示运行态。
 */
import type {
  BuddyEventName,
} from '@common/types/buddyEvent'
import type {
  LightState,
  PlatformStatus,
  SoftwareLightConfig,
  SoftwareName,
  TrafficLightConfig
} from '@common/types/trafficLight'
import { MessageUtil } from '@/utils/modal'

const config = ref<TrafficLightConfig | null>(null)
const saving = ref(false)
/** 当前软件的事件接入配置状态（如 opencode 插件安装态） */
const platformStatus = ref<PlatformStatus | null>(null)
/** 连接运行态（main 推送；渲染层纯展示） */
const connectedPath = ref<string | null>(null)
/** 硬件调试模式：开启后页面显示手动测试面板（伙伴窗口本地状态） */
const debugMode = ref(false)

let initialized = false

/** 以 main 为准回读整份配置 */
async function reload(): Promise<void> {
  config.value = await window.preload.trafficLight.getConfig()
}

/** 查询指定软件的事件接入配置状态（与内置模板内容比对） */
async function checkPlatform(name: SoftwareName): Promise<void> {
  platformStatus.value = await window.preload.trafficLight.checkPlatform(name)
}

/** 安装/更新指定软件的事件接入配置，成功后刷新状态（opencode 需重启后加载插件） */
async function installPlatform(name: SoftwareName): Promise<void> {
  const result = await window.preload.trafficLight.installPlatform(name)
  if (!result.ok) {
    MessageUtil.error(result.msg || '安装失败')
    return
  }
  MessageUtil.success('已安装，重启 opencode 后生效')
  await checkPlatform(name)
}

/** 保存单个软件配置（无论成败都回读，UI 始终与 main 对齐） */
async function saveSoftware(name: SoftwareName, next: SoftwareLightConfig): Promise<void> {
  saving.value = true
  try {
    const result = await window.preload.trafficLight.saveSoftwareConfig(name, next)
    if (!result.ok) MessageUtil.error(result.msg || '保存失败')
  } catch (e) {
    MessageUtil.error('保存失败：' + (e as Error).message)
  } finally {
    await reload()
    saving.value = false
  }
}

/** 绑定单事件灯态（即改即存；''=解除绑定） */
async function bindEvent(
  name: SoftwareName,
  event: BuddyEventName,
  state: LightState | ''
): Promise<void> {
  const current = config.value?.config[name]
  if (!current) return
  const bindings = { ...current.bindings }
  if (state) bindings[event] = state
  else delete bindings[event]
  await saveSoftware(name, { ...current, bindings })
}

/** 切换软件启用（软件互斥由 main 归一，回读后同步） */
async function setEnabled(name: SoftwareName, enabled: boolean): Promise<void> {
  const current = config.value?.config[name]
  if (!current) return
  await saveSoftware(name, { ...current, enabled })
}

/** 连接串口（指令发往 main；成功即记忆 lastPort，失败 toast 原因） */
async function connect(path: string): Promise<void> {
  const result = await window.preload.trafficLight.connect(path)
  if (!result.ok) MessageUtil.error(result.msg || '串口连接失败')
}

/** 断开当前连接（指令发往 main，运行态随推送同步） */
function disconnect(): Promise<void> {
  return window.preload.trafficLight.disconnect()
}

/** 发送一条灯态指令（调试面板；失败 toast） */
async function sendCommand(code: string): Promise<void> {
  try {
    await window.preload.trafficLight.sendCommand(code)
  } catch (e) {
    MessageUtil.error('指令发送失败：' + (e as Error).message)
  }
}

export function useTrafficLight() {
  if (!initialized) {
    initialized = true
    void reload()
    void checkPlatform('opencode')
    // 连接运行态：先拉一次再订阅推送（连接/断开/意外断开都由 main 广播）
    void window.preload.trafficLight.getState().then((state) => {
      connectedPath.value = state.connectedPath
    })
    let prev: string | null = null
    window.preload.trafficLight.onState((state) => {
      connectedPath.value = state.connectedPath
      if (prev && !state.connectedPath) MessageUtil.warning('串口连接已断开')
      prev = state.connectedPath
    })
  }
  return {
    config,
    saving,
    platformStatus,
    connectedPath,
    debugMode,
    bindEvent,
    setEnabled,
    checkPlatform,
    installPlatform,
    connect,
    disconnect,
    sendCommand,
    reload
  }
}
