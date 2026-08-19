interface UseTitlePaddingResult {
  // 左侧收起按钮距离左侧的距离
  l1: number
  // 左侧标题按钮距离左侧的距离
  l2: number
  // 左侧标题按钮距离左侧的距离（当在 /design/detail/ 页面时）
  l3: number
  // 右侧按钮为避让系统窗口控制按钮所需的额外右边距
  r1: number
}

/** App.vue common-operator 的按钮尺寸与间距 */
const OPERATOR_SIZE = 32
const OPERATOR_GAP = 8

/**
 * 按操作系统适配标题栏左右边距：
 * macOS 交通灯在左上角（trafficLightPosition: x=8，宽约 62px），
 * Windows/Linux 窗口控制按钮在右上角（titleBarOverlay，宽约 138px）。
 */
export const useTitlePadding = (): UseTitlePaddingResult => {
  const isMac = window.preload.inject.os.isMacOS()
  // macOS 需让出左侧交通灯；其余平台左侧无系统按钮
  const l1 = isMac ? 76 : OPERATOR_GAP
  // 收起按钮 + 新建按钮两个占位后的标题起点
  const l2 = l1 + (OPERATOR_SIZE + OPERATOR_GAP) * 2
  // /design/detail/ 页面不展示新建按钮
  const l3 = l1 + OPERATOR_SIZE + OPERATOR_GAP
  // 右侧叠加在各 header 基础 padding 之上的避让值
  const r1 = isMac ? 0 : 138 + OPERATOR_GAP
  return { l1, l2, l3, r1 }
}
