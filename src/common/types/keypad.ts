/**
 * 小键盘（keypad）域类型契约：main / preload / renderer 跨端共享。
 * 设备为串口输入设备（9600 波特率，行协议 `<键位>,<on|off>`），main 收到按键后
 * 按键位绑定驱动动作。动作类型注册表化：类型联合在此（纯数据），
 * 动作定义（label/normalize）在 @common/keypad/actions，main 执行器与渲染层编辑器各有注册表。
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
  'enter',
  'f1',
  'f2',
  'f3',
  'f4',
  'f5',
  'f6',
  'f7',
  'f8',
  'f9',
  'f10',
  'f11',
  'f12',
  'f13',
  'f14',
  'f15',
  'f16',
  'f17',
  'f18',
  'f19',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9'
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

/** 键位动作类型（新增动作 = 加联合成员 + 在 @common/keypad/actions 注册定义 + main 执行器 + 渲染层编辑器） */
export type KeypadActionType = 'combo' | 'app' | 'script'

/** 模拟按键/组合快捷键：修饰键组合 + 主键（可为空组合=只按主键）；按下按住、释放抬起（push-to-talk） */
export interface KeypadComboAction {
  type: 'combo'
  modifiers: KeypadModifier[]
  key: KeypadKeyName
}

/** 打开指定应用：应用绝对路径（本机应用目录选择或自定义路径） */
export interface KeypadAppAction {
  type: 'app'
  path: string
}

/** 执行指定脚本：任意 shell 命令串（主进程 cliRun 执行） */
export interface KeypadScriptAction {
  type: 'script'
  command: string
}

/** 键位动作（按 type 判别；落盘 keypad.json bindings 的值） */
export type KeypadAction = KeypadComboAction | KeypadAppAction | KeypadScriptAction

/**
 * 键盘样式布局 id（纯展示概念，落盘到 config.layout 供下次进入还原）。
 * 布局定义（跨行跨列排布）在渲染层 keypadLayouts 注册表，
 * 新增样式 = 加联合成员 + IDS 登记一行 + 渲染层注册表加布局定义。
 */
export type KeypadLayoutId = 'grid4x2'

/** 布局 id 全集（归一化白名单；与渲染层布局注册表保持同步） */
export const KEYPAD_LAYOUT_IDS: readonly KeypadLayoutId[] = ['grid4x2']

/** 布局 id 白名单校验（配置归一化用） */
export function isKeypadLayoutId(value: string): value is KeypadLayoutId {
  return (KEYPAD_LAYOUT_IDS as readonly string[]).includes(value)
}

/** 本机应用目录条目（应用下拉选项源；path 为可打开的绝对路径） */
export interface AppCatalogItem {
  /** 展示名（mac 为 .app 目录名去后缀；win 为 .lnk 文件名去后缀） */
  name: string
  /** 绝对路径（mac 为 *.app 目录；win 为 *.lnk 快捷方式） */
  path: string
}

/** 小键盘配置（落盘结构）：lastPort 记忆串口 + bindings（键位 id → 动作）+ layout 键盘样式 */
export interface KeypadConfig {
  /** 上次使用的串口路径；未记录为空串 */
  lastPort: string
  /** 键位绑定表：键为设备行协议里的键位 id（如 '1'..'6'），缺省 = 未绑定仅状态展示 */
  bindings: Record<string, KeypadAction>
  /** 键盘样式布局 id（纯展示偏好；非法/缺省归一化为首个布局） */
  layout: KeypadLayoutId
}

/** 保存/连接操作结果（失败时 msg 为中文原因，不抛错） */
export interface KeypadResult {
  ok: boolean
  msg?: string
}

/** 小键盘运行态（渲染层纯展示用；连接编排/按键解析/动作执行都在 main） */
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
  saveBindings(bindings: Record<string, KeypadAction>): Promise<KeypadResult>
  /** 保存键盘样式布局（main 校验白名单后落盘） */
  saveLayout(layout: KeypadLayoutId): Promise<KeypadResult>
  /** 本机应用目录（应用下拉选项源；main 扫描系统应用清单） */
  listApps(): Promise<AppCatalogItem[]>
  /** 连接串口（9600 固定波特率；成功即记忆 lastPort 并广播运行态） */
  connect(path: string): Promise<KeypadResult>
  /** 断开当前连接（同时释放所有按住中的组合键） */
  disconnect(): Promise<void>
  /** 读取运行态（连接/按下/权限） */
  getState(): Promise<KeypadState>
  /** 订阅运行态变化推送（连接/断开/意外断开/按下变化）；返回取消订阅函数 */
  onState(callback: (state: KeypadState) => void): () => void
}
