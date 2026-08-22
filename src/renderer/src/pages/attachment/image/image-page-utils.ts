/** 文生图页面纯函数工具 */

/** 时间戳 → 本地时间字符串（YYYY-MM-DD HH:mm） */
export const formatDateTime = (ts: number): string => {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 本地绝对路径 → mistrelle:// URL（页面图片统一走本地协议显示） */
export const pathToHref = (path: string): string => window.preload.net.pathToHref(path)