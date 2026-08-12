export const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp
  const m = 60 * 1000
  const h = 60 * m
  const d = 24 * h
  if (diff < m) return '刚刚'
  if (diff < h) return `${Math.floor(diff / m)} 分钟前`
  if (diff < d) return `${Math.floor(diff / h)} 小时前`
  return `${Math.floor(diff / d)} 天前`
}
