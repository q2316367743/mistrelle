/**
 * 小键盘（keypad）域类型契约：main / preload / renderer 跨端共享。
 * 设备为串口输入设备（9600 波特率，行协议 `<键位>,<on|off>`），main 收到按键后
 * 可按绑定驱动系统级模拟按键（koffi 直调平台 API）。
 * 约定：联合 type 独立命名一次、Options 名称映射紧跟；主键全集从 KEY_CODES 元组派生防失同步；
 * 通道常量在 @common/buddy/keypad/keypadChannels，
 * window 挂载由渲染层 vite-env.d.ts 声明（仅伙伴窗口独立 preload 注入）。
 */
import { CommonSelect } from './CommonSelect'

/** 修饰键（meta 在 macOS 为 Command、Windows 为 Win 键） */
export type KeypadModifier = 'ctrl' | 'alt' | 'shift' | 'meta'

/** 修饰键名称映射（绑定编辑的勾选项源） */
export const KeypadModifierOptions: Array<CommonSelect<KeypadModifier>> = [
  { value: 'ctrl', label: 'Ctrl' },
  { value: 'alt', label: 'Alt' },
  { value: 'shift', label: 'Shift' },
  { value: 'meta', label: 'Cmd/Win' }
]

/** 修饰键全集（运行时校验用，派生自 KeypadModifierOptions） */
export const KEYPAD_MODIFIER_CODES: readonly KeypadModifier[] = KeypadModifierOptions.map(
  (opt) => opt.value
)

/** 修饰键白名单校验（配置归一化与各端共用） */
export function isKeypadModifier(value: string): value is KeypadModifier {
  return (KEYPAD_MODIFIER_CODES as readonly string[]).includes(value)
}

/**
 * 模拟按键主键全集（白名单元组：F1–F19 + 字母 + 数字，跨平台都有虚拟键码对应；
 * 后续拓展键位直接往元组追加，类型/选项/校验自动同步）。
 */
const KEYPAD_KEY_CODES = [
  'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
  'f13', 'f14', 'f15', 'f16', 'f17', 'f18', 'f19',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
] as const

/** 模拟按键主键名（小写；展示层转大写） */
export type KeypadKeyName = (typeof KEYPAD_KEY_CODES)[number]

/** 主键名称映射（绑定编辑下拉选项源，filterable 使用） */
export const KeypadKeyOptions: Array<CommonSelect<KeypadKeyName>> = KEYPAD_KEY_CODES.map(
  (code) => ({ value: code, label: code.toUpperCase() })
)

/** 主键白名单校验（配置归一化与各端共用） */
export function isKeypadKeyName(value: string): value is KeypadKeyName {
  return (KEYPAD_KEY_CODES as readonly string[]).includes(value)
}

/** 按键动作（设备行协议 `<键位>,<动作>`：on=按下、off=释放） */
export type KeypadKeyAction = 'on' | 'off'

/** 按键动作白名单校验（行协议解析用） */
export function isKeypadKeyAction(value: string): value is KeypadKeyAction {
  return value === 'on' || value === 'off'
}

/** 单个键位的模拟按键绑定：修饰键组合 + 主键（可为空组合=只按主键） */
export interface KeypadBinding {
  modifiers: KeypadModifier[]
  key: KeypadKeyName
}

/** 小键盘配置（落盘结构）：lastPort 记忆串口 + bindings（键位 id → 绑定，键位支持任意数量） */
export interface KeypadConfig {
  /** 上次使用的串口路径；未记录为空串 */
  lastPort: string
  /** 键位绑定表：键为设备行协议里的键位 id（如 '1'..'6'），缺省 = 不模拟仅状态展示 */
  bindings: Record<string, KeypadBinding>
}

/** 保存/连接操作结果（失败时 msg 为中文原因，不抛错） */
export interface KeypadResult {
  ok: boolean
  msg?: string
}

/** 小键盘运行态（渲染层纯展示用；连接编排/按键解析/模拟都在 main） */
export interface KeypadState {
  /** 当前已连接的串口路径（= 配置 lastPort 已开时）；未连接为 null */
  connectedPath: string | null
  /** 当前按下的键位 id 列表（含未绑定的键位） */
  pressed: string[]
  /** 系统级模拟按键权限是否就绪（macOS 为辅助功能授权检测，Windows 恒 true） */
  accessibilityGranted: boolean
}

/** window.preload.keypad 契约：小键盘域桥（仅伙伴窗口的独立 preload 注入，主窗口运行时不存在） */
export interface KeypadApi {
  /** 读取整份配置（含 lastPort 与键位绑定） */
  getConfig(): Promise<KeypadConfig>
  /** 全量保存键位绑定表；main 归一化清洗后落盘 */
  saveBindings(bindings: Record<string, KeypadBinding>): Promise<KeypadResult>
  /** 连接串口（9600 固定波特率；成功即记忆 lastPort 并广播运行态） */
  connect(path: string): Promise<KeypadResult>
  /** 断开当前连接（同时释放所有按住中的组合键） */
  disconnect(): Promise<void>
  /** 读取运行态（连接/按下/权限） */
  getState(): Promise<KeypadState>
  /** 订阅运行态变化推送（连接/断开/意外断开/按下变化）；返回取消订阅函数 */
  onState(callback: (state: KeypadState) => void): () => void
}
