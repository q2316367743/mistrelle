/** 文生图页面纯函数工具 */

/** 时间戳 → 本地时间字符串（YYYY-MM-DD HH:mm） */
export const formatDateTime = (ts: number): string => {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 本地绝对路径 → mistrelle:// URL（页面图片统一走本地协议显示） */
export const pathToHref = (path: string): string => window.preload.net.pathToHref(path)

/**
 * 失败记录是否可「重试（对同一远端任务续轮询）」：
 * 仅看异步任务型（带 taskId）且远端未确认终态。远端是自研服务端，任务持续可查
 * （poll_max_at 只是单次轮询会话的本地预算，不作为重试资格——超时失败正是最该续询的场景）；
 * 同步失败 / 提交即失败（无远端任务）与已确认终态失败均只可删除。
 */
export const isRetryableFailed = (rec: ImageRecordInput): boolean =>
  rec.status === 'failed' && !!rec.taskId && rec.taskTerminal !== true