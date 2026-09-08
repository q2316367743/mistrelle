/**
 * 小键盘配置状态（模块级单例）：配置经 IPC 读写（main 持有文件并归一化），
 * 绑定即改即存，保存后以 main 回读为准（失败自动回滚 UI）。
 * 连接编排/按键解析/模拟按键都在 main（keypadService），渲染层只发指令与展示运行态。
 */
import type { KeypadBinding, KeypadConfig } from '@common/types/keypad'
import { MessageUtil } from '@/utils/modal'

const config = ref<KeypadConfig | null>(null)
/** 运行态（main 推送；渲染层纯展示） */
const connectedPath = ref<string | null>(null)
const pressed = ref<string[]>([])
/** 系统级模拟按键权限（macOS 辅助功能授权；Windows 恒 true） */
const accessibilityGranted = ref(true)

let initialized = false

/** 以 main 为准回读整份配置 */
async function reload(): Promise<void> {
  config.value = await window.preload.keypad.getConfig()
}

/** 全量保存键位绑定（无论成败都回读，UI 始终与 main 对齐） */
async function saveBindings(bindings: Record<string, KeypadBinding>): Promise<void> {
  try {
    // config 来自 ref（深层 reactive）：浅展开后的嵌套绑定对象仍是 Proxy，跨桥会克隆失败，须深拷贝
    const plain = JSON.parse(JSON.stringify(bindings)) as Record<string, KeypadBinding>
    const result = await window.preload.keypad.saveBindings(plain)
    if (!result.ok) MessageUtil.error(result.msg || '保存失败')
  } catch (e) {
    MessageUtil.error('保存失败：' + (e as Error).message)
  } finally {
    await reload()
  }
}

/** 绑定单个键位（即改即存；binding=null 解除绑定） */
async function bindKey(keyId: string, binding: KeypadBinding | null): Promise<void> {
  const current = config.value
  if (!current) return
  const bindings = { ...current.bindings }
  if (binding) bindings[keyId] = binding
  else delete bindings[keyId]
  await saveBindings(bindings)
}

/** 连接串口（指令发往 main；成功即记忆 lastPort，失败 toast 原因） */
async function connect(path: string): Promise<void> {
  const result = await window.preload.keypad.connect(path)
  if (!result.ok) MessageUtil.error(result.msg || '串口连接失败')
}

/** 断开当前连接（指令发往 main，运行态随推送同步） */
function disconnect(): Promise<void> {
  return window.preload.keypad.disconnect()
}

export function useKeypad() {
  if (!initialized) {
    initialized = true
    void reload()
    // 运行态：先拉一次再订阅推送（连接/断开/意外断开/按下变化都由 main 广播）
    void window.preload.keypad.getState().then((state) => {
      connectedPath.value = state.connectedPath
      pressed.value = state.pressed
      accessibilityGranted.value = state.accessibilityGranted
    })
    let prev: string | null = null
    window.preload.keypad.onState((state) => {
      connectedPath.value = state.connectedPath
      pressed.value = state.pressed
      accessibilityGranted.value = state.accessibilityGranted
      if (prev && !state.connectedPath) MessageUtil.warning('串口连接已断开')
      prev = state.connectedPath
    })
  }
  return {
    config,
    connectedPath,
    pressed,
    accessibilityGranted,
    bindKey,
    connect,
    disconnect,
    reload
  }
}
