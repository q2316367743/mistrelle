/** 文生图页面纯函数工具 */

/** 生成表单提交载荷（n/分辨率/高级参数未设置的字段不传，由 main 决定是否透传服务端） */
export interface ImageFormSubmit {
  prompt: string
  size?: string
  model?: string
  styleId?: string
  /** 单次生成张数（1-4） */
  n?: number
  /** 像素档位（1k / 2k / 4k） */
  resolution?: string
  quality?: string
  background?: string
  outputFormat?: string
  outputCompression?: number
  moderation?: string
  nsfwCheck?: boolean
  /** 参考图本地绝对路径（main 归一化为 data URI 透传） */
  imageUrls?: string[]
}

/** 高级参数子集（折叠面板编辑的字段，父级持有状态） */
export type ImageAdvancedState = Pick<
  ImageFormSubmit,
  'quality' | 'background' | 'outputFormat' | 'outputCompression' | 'moderation' | 'nsfwCheck'
>

/** 时间戳 → 本地时间字符串（YYYY-MM-DD HH:mm） */
export const formatDateTime = (ts: number): string => {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 本地绝对路径 → 本地事件服务资源 URL（页面图片统一走 /file 资源面显示） */
export const pathToHref = (path: string): string => window.preload.net.pathToHref(path)

/**
 * 失败记录是否可「重试（对同一远端任务续轮询）」：
 * 仅看异步任务型（带 taskId）且远端未确认终态。远端是自研服务端，任务持续可查
 * （poll_max_at 只是单次轮询会话的本地预算，不作为重试资格——超时失败正是最该续询的场景）；
 * 同步失败 / 提交即失败（无远端任务）与已确认终态失败均只可删除。
 */
export const isRetryableFailed = (rec: ImageRecordInput): boolean =>
  rec.status === 'failed' && !!rec.taskId && rec.taskTerminal !== true