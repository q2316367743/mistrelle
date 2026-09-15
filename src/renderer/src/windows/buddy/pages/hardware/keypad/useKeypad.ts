/**
 * 小键盘配置状态（模块级单例）：配置经 IPC 读写（main 持有文件并归一化），
 * 绑定即改即存，保存后以 main 回读为准（失败自动回滚 UI）。
 * 连接编排/按键解析/动作执行都在 main（keypadService），渲染层只发指令与展示运行态。
 */
import type {
  AppCatalogItem,
  KeypadBinding,
  KeypadBindingMap,
  KeypadBindSignal,
  KeypadConfig,
  KeypadLayoutId,
  KeypadSignalState
} from '@common/types/keypad'
import { MessageUtil } from '@/utils/modal'

const config = ref<KeypadConfig | null>(null)
/** 运行态（main 推送；渲染层纯展示） */
const connectedPath = ref<string | null>(null)
const pressed = ref<KeypadSignalState[]>([])
/** 最近转动信号（main 侧超时自动过期；仅用于旋钮瞬时高亮） */
const rotation = ref<KeypadSignalState[]>([])
/** 系统级模拟按键权限（macOS 辅助功能授权；Windows 恒 true） */
const accessibilityGranted = ref(true)
/** 本机应用目录（应用编辑器下拉选项源；首次加载后模块级缓存） */
const apps = ref<AppCatalogItem[]>([])

let initialized = false
let appsLoaded = false

/** 以 main 为准回读整份配置 */
async function reload(): Promise<void> {
  config.value = await window.preload.keypad.getConfig()
}

/** 全量保存控件绑定表（无论成败都回读，UI 始终与 main 对齐） */
async function saveBindings(bindings: Record<string, KeypadBindingMap>): Promise<void> {
  try {
    // config 来自 ref（深层 reactive）：浅展开后的嵌套动作对象仍是 Proxy，跨桥会克隆失败，须深拷贝
    const plain = JSON.parse(JSON.stringify(bindings)) as Record<string, KeypadBindingMap>
    const result = await window.preload.keypad.saveBindings(plain)
    if (!result.ok) MessageUtil.error(result.msg || '保存失败')
  } catch (e) {
    MessageUtil.error('保存失败：' + (e as Error).message)
  } finally {
    await reload()
  }
}

/** 绑定单个控件的某一路信号（即改即存；binding 为 null/空序列 = 解除该路绑定，无其他路时空控件一并移除） */
async function bindKey(
  controlId: string,
  signal: KeypadBindSignal,
  binding: KeypadBinding | null
): Promise<void> {
  const current = config.value
  if (!current) return
  const bindings: Record<string, KeypadBindingMap> = { ...current.bindings }
  const map: KeypadBindingMap = { ...bindings[controlId] }
  if (binding && binding.actions.length) map[signal] = binding
  else delete map[signal]
  if (Object.keys(map).length) bindings[controlId] = map
  else delete bindings[controlId]
  await saveBindings(bindings)
}

/** 保存键盘样式布局（即改即存，失败 toast，回读对齐） */
async function saveLayout(layout: KeypadLayoutId): Promise<void> {
  try {
    const result = await window.preload.keypad.saveLayout(layout)
    if (!result.ok) MessageUtil.error(result.msg || '保存失败')
  } catch (e) {
    MessageUtil.error('保存失败：' + (e as Error).message)
  } finally {
    await reload()
  }
}

/** 加载本机应用目录（模块级缓存只拉一次；编辑器挂载时按需调用） */
async function loadApps(): Promise<void> {
  if (appsLoaded) return
  appsLoaded = true
  try {
    apps.value = await window.preload.keypad.listApps()
  } catch (e) {
    appsLoaded = false
    MessageUtil.error('应用列表加载失败：' + (e as Error).message)
  }
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
    // 运行态：先拉一次再订阅推送（连接/断开/意外断开/按下/转动都由 main 广播）
    void window.preload.keypad.getState().then((state) => {
      connectedPath.value = state.connectedPath
      pressed.value = state.pressed
      rotation.value = state.rotation
      accessibilityGranted.value = state.accessibilityGranted
    })
    let prev: string | null = null
    window.preload.keypad.onState((state) => {
      connectedPath.value = state.connectedPath
      pressed.value = state.pressed
      rotation.value = state.rotation
      accessibilityGranted.value = state.accessibilityGranted
      if (prev && !state.connectedPath) MessageUtil.warning('串口连接已断开')
      prev = state.connectedPath
    })
  }
  return {
    config,
    connectedPath,
    pressed,
    rotation,
    accessibilityGranted,
    apps,
    bindKey,
    saveBindings,
    saveLayout,
    loadApps,
    connect,
    disconnect,
    reload
  }
}
