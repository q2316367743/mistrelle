/**
 * 红绿灯配置状态（模块级单例）：配置经 IPC 读写（main 持有文件并校验）。
 * 即改即存，保存后以 main 回读为准（失败自动回滚 UI）；串口连接成功后自动记忆 lastPort。
 */
import { MessageUtil } from '@/utils/modal'
import { useSerialLink } from '../useSerialLink'

const config = ref<TrafficLightConfig | null>(null)
const saving = ref(false)

let initialized = false

/** 以 main 为准回读整份配置 */
async function reload(): Promise<void> {
  config.value = await window.preload.trafficLight.getConfig()
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
  event: OpencodeEventName,
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

export function useTrafficLight() {
  if (!initialized) {
    initialized = true
    void reload()
    // 串口连接成功后记忆端口（含手动重连），供下次启动自动连接
    const { connectedPath } = useSerialLink()
    watch(connectedPath, (path) => {
      if (path) void window.preload.trafficLight.setLastPort(path)
    })
  }
  return { config, saving, bindEvent, setEnabled, reload }
}
