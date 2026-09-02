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
 * 失败记录是否可「重试（续轮询同一个远端任务）」：
 * 仅异步任务型（带 taskId）、远端未确认终态、且未超 5 分钟查询窗口时才可续；
 * 同步失败 / 提交即失败（无远端任务）与已确认终态失败均只可删除。
 */
export const isRetryableFailed = (rec: ImageRecordInput): boolean =>
  rec.status === 'failed' && !!rec.taskId && rec.taskTerminal !== true

/** isRetryableFailed 且仍在查询窗口内（pollMaxAt 未过期；无 pollMaxAt 的旧数据默认窗口内） */
export const canResumePoll = (rec: ImageRecordInput): boolean =>
  isRetryableFailed(rec) && (rec.pollMaxAt == null || rec.pollMaxAt > Date.now())