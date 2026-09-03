/**
 * browser 域 IPC 契约：browserTool 通道与载荷/结果类型。
 * preload 桥与 main handler 共用，保持两侧契约一致。
 */
// ── browserTool ────────────────────────────────────────────
export const BrowserToolChannels = {
  /** 执行浏览器工具（browser_fetch / browser_actions）：main 内直接创建隐藏窗口执行 */
  run: 'browserTool:run'
} as const

/** browser_fetch 载荷：隐藏窗口导航 + 等待渲染 + 提取内容 */
export interface BrowserToolFetchPayload {
  kind: 'fetch'
  /** 目标 URL */
  url: string
  /** 等待 JS 渲染的毫秒数（默认 3000） */
  waitMs?: number
  /** 输出格式：markdown（默认）/ text / html */
  mode?: 'markdown' | 'text' | 'html'
  /** CSS 选择器：只提取匹配元素（未命中抛错），省略则提取整页 */
  selector?: string
}

/** browser_actions 的单步操作（type + 类型相关字段，与工具 schema 一致） */
export interface BrowserToolActionStep {
  /** 操作类型：goto/click/value/evaluate/wait/screenshot/press/paste/scroll/cookies/getHtml/getText/getTitle/hide/show/viewport/useragent/css */
  type: string
  [key: string]: unknown
}

/** browser_actions 载荷：步骤数组 + 窗口配置 */
export interface BrowserToolActionsPayload {
  kind: 'actions'
  steps: BrowserToolActionStep[]
  /** 窗口配置（show: true 时显示窗口） */
  options?: {
    show?: boolean
    width?: number
    height?: number
    [key: string]: unknown
  }
}

export type BrowserToolPayload = BrowserToolFetchPayload | BrowserToolActionsPayload

/** browserTool 运行结果（main BrowserToolRunner → preload） */
export interface BrowserToolResult {
  /** 收集的返回值列表（每个 evaluate 类步骤可能产生一个值） */
  data: unknown[]
  /** 是否出错 */
  error?: boolean
  /** 错误消息 */
  message?: string
}
