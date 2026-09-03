type WindowKind = 'main' | 'buddy'

interface UseTitlePaddingOptions {
  /**
   * 窗口形态：主窗口 `common-operator` 含「收起 + 新建」两个按钮，
   * 伙伴窗口仅「收起」一个按钮。
   * 仅在各自窗口入口 App.vue 声明一次，声明后整个窗口（含共享的 PageLayout 等）
   * 折叠态标题起点均按该形态预留；主窗口为默认值可不传。
   */
  kind?: WindowKind
}

interface UseTitlePaddingResult {
  // 左侧收起按钮距离左侧的距离
  l1: number
  // 侧栏折叠态标题起点：按当前窗口操作按钮形态预留（main=收起+新建两按钮 / buddy=仅收起一按钮）
  l2: number
  // 仅收起按钮一个占位时的标题起点（主窗口 /design/detail/ 等不展示新建按钮的页面用）
  l3: number
  // 右侧按钮为避让系统窗口控制按钮所需的额外右边距
  r1: number
}

/** App.vue common-operator 的按钮尺寸与间距 */
const OPERATOR_SIZE = 32
const OPERATOR_GAP = 8

/** 模块级窗口形态：buddy/App.vue 入口声明一次，窗口内共享（主窗口默认 'main'） */
let windowKind: WindowKind = 'main'

/**
 * 按操作系统与窗口形态适配标题栏左右边距：
 * macOS 交通灯在左上角（trafficLightPosition: x=8，宽约 62px），
 * Windows/Linux 窗口控制按钮在右上角（titleBarOverlay，宽约 138px）。
 * 两窗口均为独立 renderer 进程，各自加载本模块，模块级形态互不污染。
 */
export const useTitlePadding = (options?: UseTitlePaddingOptions): UseTitlePaddingResult => {
  if (options?.kind) windowKind = options.kind
  const isMac = window.preload.inject.os.isMacOS()
  // macOS 需让出左侧交通灯；其余平台左侧无系统按钮
  const l1 = isMac ? 76 : OPERATOR_GAP
  const step = OPERATOR_SIZE + OPERATOR_GAP
  // 折叠态标题起点：主窗口预留两个按钮（收起+新建），伙伴窗口仅预留收起一个按钮
  const l2 = l1 + step * (windowKind === 'buddy' ? 1 : 2)
  // 单按钮形态（不展示新建按钮的场景，如 /design/detail/）与 buddy 窗口一致
  const l3 = l1 + step
  // 右侧叠加在各 header 基础 padding 之上的避让值
  const r1 = isMac ? 0 : 138 + OPERATOR_GAP
  return { l1, l2, l3, r1 }
}
