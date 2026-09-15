/**
 * 小键盘（keypad）域类型契约：main / preload / renderer 跨端共享。
 * 设备为串口输入设备（9600 波特率，行协议 `<控件id>,<信号>[,<幅度两位>]`），main 收到信号后
 * 按「控件 + 信号」绑定驱动动作。
 *
 * **控件模型（三层）**：
 * - 基础类型 `KeypadControlKind`：button（内置 on/off）、knob（内置 left/right）——一个控件占一个 id
 * - 拓展能力 `KeypadControlCapability`：press（可按压，叠加 on/off）、detent（有极，转动信号带幅度）
 * - 派生信号集：由 @common/keypad/controls 的 `keypadControlSignals(kind, caps)` 算出，
 *   布局注册表只声明 kind + capabilities，不写死具体信号
 *
 * 动作类型注册表化：类型联合在此（纯数据），动作定义（label/normalize）在 @common/keypad/actions，
 * main 执行器与渲染层编辑器各有注册表。
 * 约定：联合 type 独立命名一次、Options 名称映射紧跟；主键全集从 KEY_CODES 元组派生防失同步；
 * 通道常量在 @common/buddy/keypad/keypadChannels，
 * window 挂载由渲染层 vite-env.d.ts 声明（仅伙伴窗口独立 preload 注入）。
 */
import { CommonSelect } from './CommonSelect'
import type { PermissionDecision } from './permissionRequest'

/**
 * 修饰键（meta 在 macOS 为 Command、Windows 为 Win 键）。
 * fn 仅 macOS 有意义：它是 flagsChanged 标志位（kCGEventFlagMaskSecondaryFn），不是普通按键，
 * 故归入修饰键而非主键——可单独按住，也可参与组合；Windows 无对应键，投递时静默跳过。
 */
export type KeypadModifier = 'ctrl' | 'alt' | 'shift' | 'meta' | 'fn'

/** 修饰键名称映射（绑定编辑的勾选项源） */
export const KeypadModifierOptions: Array<CommonSelect<KeypadModifier>> = [
  { value: 'ctrl', label: 'Ctrl' },
  { value: 'alt', label: 'Alt' },
  { value: 'shift', label: 'Shift' },
  { value: 'meta', label: 'Cmd/Win' },
  { value: 'fn', label: 'Fn' }
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
 * 模拟按键主键白名单（普通键元组：F1–F19 + 字母 + 数字 + Enter，跨平台都有虚拟键码对应；
 * 后续拓展键位直接往元组追加，类型/选项/校验自动同步）。
 * 媒体/系统功能键见下方 KEYPAD_MEDIA_KEY_CODES（另一条投递路径，不能混入本表）。
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

/** 普通模拟按键主键名（小写；展示层转大写） */
export type KeypadRegularKeyName = (typeof KEYPAD_KEY_CODES)[number]

/**
 * 媒体 / 系统功能键（白名单元组）：无修饰键语义。
 * macOS 走 NX_SYSDEFINED 系统定义事件、Windows 走 VK_* 虚拟键（亮度 Windows 无标准虚拟键，
 * 见 keySimulator 跳过）；这类键无法用键盘录制捕获（录制只认 event.code），只能在编辑器下拉里选。
 */
const KEYPAD_MEDIA_KEY_CODES = [
  'volume-up',
  'volume-down',
  'mute',
  'brightness-up',
  'brightness-down',
  'play-pause',
  'track-next',
  'track-prev'
] as const

/** 媒体 / 系统功能键名 */
export type KeypadMediaKeyName = (typeof KEYPAD_MEDIA_KEY_CODES)[number]

/** 模拟按键主键名（普通键 + 媒体键） */
export type KeypadKeyName = KeypadRegularKeyName | KeypadMediaKeyName

/** 媒体键中文名（下拉与摘要展示；普通键仍展示全大写名） */
const KEYPAD_MEDIA_KEY_LABELS: Record<KeypadMediaKeyName, string> = {
  'volume-up': '音量 +',
  'volume-down': '音量 -',
  mute: '静音',
  'brightness-up': '亮度 +',
  'brightness-down': '亮度 -',
  'play-pause': '播放/暂停',
  'track-next': '下一曲',
  'track-prev': '上一曲'
}

/** 主键名称映射（绑定编辑下拉选项源，filterable 使用；普通键全大写 + 媒体键中文名） */
export const KeypadKeyOptions: Array<CommonSelect<KeypadKeyName>> = [
  ...KEYPAD_KEY_CODES.map((code) => ({ value: code, label: code.toUpperCase() })),
  ...KEYPAD_MEDIA_KEY_CODES.map((code) => ({ value: code, label: KEYPAD_MEDIA_KEY_LABELS[code] }))
]

/** 媒体键选项（编辑器「功能键」下拉专用；从同一元组派生防失同步） */
export const KeypadMediaKeyOptions: Array<CommonSelect<KeypadMediaKeyName>> =
  KEYPAD_MEDIA_KEY_CODES.map((code) => ({ value: code, label: KEYPAD_MEDIA_KEY_LABELS[code] }))

/** 主键展示名（普通键全大写、媒体键中文名；摘要与键帽共用） */
export function keypadKeyLabel(name: KeypadKeyName): string {
  return KeypadKeyOptions.find((opt) => opt.value === name)?.label ?? name
}

/** 普通主键白名单校验（录制映射用） */
export function isKeypadRegularKeyName(value: string): value is KeypadRegularKeyName {
  return (KEYPAD_KEY_CODES as readonly string[]).includes(value)
}

/** 媒体键白名单校验（执行侧分发与编辑器收窄用） */
export function isKeypadMediaKeyName(value: string): value is KeypadMediaKeyName {
  return (KEYPAD_MEDIA_KEY_CODES as readonly string[]).includes(value)
}

/** 主键白名单校验（普通键 + 媒体键；配置归一化与各端共用） */
export function isKeypadKeyName(value: string): value is KeypadKeyName {
  return isKeypadRegularKeyName(value) || isKeypadMediaKeyName(value)
}

/** 控件基础类型（设备物理形态；内置信号集见 @common/keypad/controls 的 CONTROL_SIGNALS） */
export type KeypadControlKind = 'button' | 'knob'

/** 控件基础类型名称映射 */
export const KeypadControlKindOptions: Array<CommonSelect<KeypadControlKind>> = [
  { value: 'button', label: '按键' },
  { value: 'knob', label: '旋钮' }
]

/** 控件基础类型全集（运行时校验用，派生自 Options） */
export const KEYPAD_CONTROL_KINDS: readonly KeypadControlKind[] = KeypadControlKindOptions.map(
  (opt) => opt.value
)

/** 控件基础类型白名单校验（布局归一化用） */
export function isKeypadControlKind(value: string): value is KeypadControlKind {
  return (KEYPAD_CONTROL_KINDS as readonly string[]).includes(value)
}

/**
 * 控件拓展能力（在基础类型之上叠加，可多选）：
 * - press 可按压：给 knob 叠加 on/off（button 本就自带 on/off，叠加为幂等）
 * - detent 有极：不新增信号，而是让转动信号携带幅度（百分比两位）
 */
export type KeypadControlCapability = 'press' | 'detent'

/** 拓展能力名称映射 */
export const KeypadControlCapabilityOptions: Array<CommonSelect<KeypadControlCapability>> = [
  { value: 'press', label: '可按压' },
  { value: 'detent', label: '有极（转动带幅度）' }
]

/** 拓展能力全集（运行时校验用，派生自 Options） */
export const KEYPAD_CONTROL_CAPABILITIES: readonly KeypadControlCapability[] =
  KeypadControlCapabilityOptions.map((opt) => opt.value)

/** 拓展能力白名单校验（布局归一化用） */
export function isKeypadControlCapability(value: string): value is KeypadControlCapability {
  return (KEYPAD_CONTROL_CAPABILITIES as readonly string[]).includes(value)
}

/**
 * 控件信号（行协议第二段）：
 * - on / off：按压类（按下 / 抬起），button 内置，knob 需 press 能力
 * - left / right：转动类（逆时针 / 顺时针），knob 内置；detent 时携带幅度
 */
export type KeypadSignal = 'on' | 'off' | 'left' | 'right'

/** 控件信号名称映射（顺序即界面路切换条顺序） */
export const KeypadSignalOptions: Array<CommonSelect<KeypadSignal>> = [
  { value: 'on', label: '按下' },
  { value: 'off', label: '抬起' },
  { value: 'left', label: '左转' },
  { value: 'right', label: '右转' }
]

/** 控件信号全集（协议解析与运行时校验用，派生自 Options） */
export const KEYPAD_SIGNALS: readonly KeypadSignal[] = KeypadSignalOptions.map((opt) => opt.value)

/** 控件信号白名单校验（行协议解析用） */
export function isKeypadSignal(value: string): value is KeypadSignal {
  return (KEYPAD_SIGNALS as readonly string[]).includes(value)
}

/** 信号展示名（左转/右转/按下/抬起） */
export function keypadSignalLabel(signal: KeypadSignal): string {
  return KeypadSignalOptions.find((opt) => opt.value === signal)?.label ?? signal
}

/**
 * 可绑定信号（off 仅释放语义**不可绑定**：它只做按下簿记、取消长按计时并结束长按会话，
 * 可绑定路只有「按下」与两个转动方向）。
 */
export type KeypadBindSignal = Exclude<KeypadSignal, 'off'>

/** 可绑定信号全集（配置归一化白名单；顺序与界面一致） */
export const KEYPAD_BIND_SIGNALS: readonly KeypadBindSignal[] = KEYPAD_SIGNALS.filter(
  (signal): signal is KeypadBindSignal => signal !== 'off'
)

/** 可绑定信号白名单校验（配置归一化与布局校验用） */
export function isKeypadBindSignal(value: string): value is KeypadBindSignal {
  return (KEYPAD_BIND_SIGNALS as readonly string[]).includes(value)
}

/**
 * 该信号是否支持短按/长按两段：
 * - 按压类（on）支持——按住达 KEYPAD_HOLD_MS 触发 holdActions
 * - 转动类（left/right）不支持——转动是瞬时事件（有极旋钮还带幅度），只有一段动作序列；
 *   连续快转由设备重复上报信号表达，不做长按判定。
 */
export function keypadSignalSupportsHold(signal: KeypadBindSignal): boolean {
  return signal === 'on'
}

/** 键位动作类型（新增动作 = 加联合成员 + 在 @common/keypad/actions 注册定义 + main 执行器 + 渲染层编辑器） */
export type KeypadActionType = 'combo' | 'app' | 'script' | 'permission' | 'delay' | 'url'

/**
 * 模拟按键/组合快捷键：修饰键组合 + 可选主键。
 * 序列执行到该动作时模拟一次完整击键（按下→短暂按住→自动抬起）；
 * 长按保持档不自动抬起，松手才抬起（见 resolveKeypadHoldBehavior）。
 * **主键可缺省**——用于「只按住修饰键」的场景（如按住 Fn 触发微信输入法语音输入）；
 * 此时修饰键不可为空（归一化强制），修饰键先下后上（逆序）投递。
 * 主键为媒体键（音量/亮度/播放）时修饰键无意义，归一化会强制清空。
 */
export interface KeypadComboAction {
  type: 'combo'
  modifiers: KeypadModifier[]
  key?: KeypadKeyName
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

/** 权限审批：对最近一条待审批权限请求回传允许/拒绝（权限审批基座，无待审请求时空操作） */
export interface KeypadPermissionAction {
  type: 'permission'
  decision: PermissionDecision
}

/** 延时等待：序列执行到该动作时暂停指定毫秒再继续（50–60000ms，上限防误配置长时间卡住序列） */
export interface KeypadDelayAction {
  type: 'delay'
  ms: number
}

/** 打开网页：http/https 网址，系统默认浏览器打开（main 侧 shell.openExternal） */
export interface KeypadUrlAction {
  type: 'url'
  url: string
}

/** 键位动作（按 type 判别；落盘 keypad.json bindings 值 actions 字段的元素） */
export type KeypadAction =
  | KeypadComboAction
  | KeypadAppAction
  | KeypadScriptAction
  | KeypadPermissionAction
  | KeypadDelayAction
  | KeypadUrlAction

/**
 * 长按判定阈值（全局）：按住达到该时长触发 holdActions；阈值内松手触发短按 actions。
 * 仅对支持长按的信号生效（`keypadSignalSupportsHold` = 按压类 on）；转动信号无长按判定。
 */
export const KEYPAD_HOLD_MS = 600

/**
 * 长按行为（达到 KEYPAD_HOLD_MS 阈值后如何执行 holdActions）——**由队列形状自动推导**，不做配置：
 * - keep：单条普通「模拟按键」→ 按下保持、松手才抬起（真正的长按该键）
 * - repeat：多条 → 循环执行整个队列直到松手；单条媒体键 → 循环（媒体键无保持语义，见下）
 * - once：单条非「模拟按键」（如单条打开应用）→ 只执行一次，避免反复开窗口
 */
export type KeypadHoldBehavior = 'once' | 'keep' | 'repeat'

/** 长按行为名称映射（界面展示用） */
export const KeypadHoldBehaviorOptions: Array<CommonSelect<KeypadHoldBehavior>> = [
  { value: 'once', label: '执行一次' },
  { value: 'keep', label: '保持按住' },
  { value: 'repeat', label: '持续循环' }
]

/**
 * 由长按队列形状推导行为：
 * - 多条 → repeat（循环整个队列直到松手）
 * - 单条「模拟按键」→ keep（保持按住直到松手）；缺主键（只按住修饰键，如 Fn）同走 keep
 * - 单条媒体键例外走 repeat：音量/亮度这类键由系统直接消费，按下一次只算一步，
 *   保持按住不会持续生效，只有反复触发才等价于「长按音量键」
 * - 单条其他类型 → once（单条打开应用只开一次）
 * 判定收口在此，main 执行与渲染层展示共用，避免两端规则漂移。
 */
export function resolveKeypadHoldBehavior(holdActions: KeypadAction[]): KeypadHoldBehavior {
  if (holdActions.length > 1) return 'repeat'
  const only = holdActions[0]
  if (!only || only.type !== 'combo') return 'once'
  if (only.key != null && isKeypadMediaKeyName(only.key)) return 'repeat'
  return 'keep'
}

/** 长按循环每轮之间的间隔下限（ms） */
export const KEYPAD_REPEAT_MS_MIN = 20
/** 长按循环每轮之间的间隔上限（ms） */
export const KEYPAD_REPEAT_MS_MAX = 5000
/** 长按循环每轮之间的间隔缺省值（ms） */
export const KEYPAD_REPEAT_MS_DEFAULT = 100
/** 单次按住的循环总时长上限（ms）：防 off 丢失导致无限连发 */
export const KEYPAD_REPEAT_MAX_MS = 60000

/**
 * 单路绑定：动作序列 + 可选显示名称（键帽优先显示名称，未命名回退首条动作摘要）。
 * 「短按/长按」两段只对有 `keypadSignalSupportsHold` 的信号（按压类 on）有意义；
 * 转动信号（left/right）只有 actions 一段，长按字段归一化时会被剥除。
 */
export interface KeypadBinding {
  /** 显示名称（可选；trim 非空才落盘） */
  name?: string
  /** 动作序列（短按触发；未配置 holdActions 时信号到达立即执行） */
  actions: KeypadAction[]
  /**
   * 长按动作序列（可选；仅按压信号）。配置后该路启用短按/长按互斥判定：
   * 按下启动 KEYPAD_HOLD_MS 计时，到时仍按住执行本序列，阈值内松手执行 actions。
   * 长按期间做什么由队列形状推导，见 resolveKeypadHoldBehavior。
   * 空/全非法不落盘（归一化清洗），无此字段 = 信号到达立即执行，存量行为不变。
   */
  holdActions?: KeypadAction[]
  /** 长按循环每轮之间的间隔 ms（20–5000；缺省 KEYPAD_REPEAT_MS_DEFAULT；仅推导为 repeat 时生效） */
  holdRepeatMs?: number
}

/**
 * 单控件绑定表：键 = 可绑定信号（on/left/right），值 = 该路绑定。
 * 一个控件在 bindings 里占一个键，其各路信号天然成组（旋钮的左右转与按下同属一条记录）。
 * 缺省某信号 = 该路未绑定（仅状态展示）。
 */
export type KeypadBindingMap = Partial<Record<KeypadBindSignal, KeypadBinding>>

/**
 * 键盘样式布局 id（纯展示概念，落盘到 config.layout 供下次进入还原）。
 * 布局定义（控件类型/能力/跨行跨列排布）在渲染层 keypadLayouts 注册表，
 * 新增样式 = 加联合成员 + IDS 登记一行 + 渲染层注册表加布局定义。
 */
export type KeypadLayoutId = 'grid4x2' | 'grid4x2Knob'

/** 布局 id 全集（归一化白名单；与渲染层布局注册表保持同步） */
export const KEYPAD_LAYOUT_IDS: readonly KeypadLayoutId[] = ['grid4x2', 'grid4x2Knob']

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

/**
 * 小键盘配置（落盘结构）：lastPort 记忆串口 + bindings（控件 id → 各路信号绑定）+ layout 键盘样式。
 * bindings 键 = 设备行协议里的控件 id（字符串，如 '1'、旋钮 '10'）。
 */
export interface KeypadConfig {
  /** 上次使用的串口路径；未记录为空串 */
  lastPort: string
  /** 控件绑定表：键为控件 id，值为该控件各可绑定信号的绑定（缺省信号 = 未绑定仅状态展示） */
  bindings: Record<string, KeypadBindingMap>
  /** 键盘样式布局 id（纯展示偏好；非法/缺省归一化为首个布局） */
  layout: KeypadLayoutId
}

/** 保存/连接操作结果（失败时 msg 为中文原因，不抛错） */
export interface KeypadResult {
  ok: boolean
  msg?: string
}

/** 运行态里的单个信号（控件 id + 信号；value 为转动幅度百分比，仅 detent 旋钮有） */
export interface KeypadSignalState {
  controlId: string
  signal: KeypadBindSignal
  /** 转动幅度百分比（0–99；仅转动信号且设备上报了幅度时存在） */
  value?: number
}

/** 小键盘运行态（渲染层纯展示用；连接编排/信号解析/动作执行都在 main） */
export interface KeypadState {
  /** 当前已连接的串口路径（= 配置 lastPort 已开时）；未连接为 null */
  connectedPath: string | null
  /** 当前按下的按压类信号（含未绑定的控件；off 到达即移除） */
  pressed: KeypadSignalState[]
  /** 最近发生的转动信号（瞬时高亮；main 侧超时自动过期，仅用于界面反馈） */
  rotation: KeypadSignalState[]
  /** 系统级模拟按键权限是否就绪（macOS 为辅助功能授权检测，Windows 恒 true） */
  accessibilityGranted: boolean
}

/** window.preload.keypad 契约：小键盘域桥（仅伙伴窗口的独立 preload 注入，主窗口运行时不存在） */
export interface KeypadApi {
  /** 读取整份配置（含 lastPort 与控件绑定） */
  getConfig(): Promise<KeypadConfig>
  /** 全量保存控件绑定表；main 归一化清洗后落盘 */
  saveBindings(bindings: Record<string, KeypadBindingMap>): Promise<KeypadResult>
  /** 保存键盘样式布局（main 校验白名单后落盘） */
  saveLayout(layout: KeypadLayoutId): Promise<KeypadResult>
  /** 本机应用目录（应用下拉选项源；main 扫描系统应用清单） */
  listApps(): Promise<AppCatalogItem[]>
  /** 连接串口（9600 固定波特率；成功即记忆 lastPort 并广播运行态） */
  connect(path: string): Promise<KeypadResult>
  /** 断开当前连接（同时释放所有按住中的组合键） */
  disconnect(): Promise<void>
  /** 读取运行态（连接/按下/转动/权限） */
  getState(): Promise<KeypadState>
  /** 订阅运行态变化推送（连接/断开/意外断开/按下/转动）；返回取消订阅函数 */
  onState(callback: (state: KeypadState) => void): () => void
}
