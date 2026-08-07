/** 判断 target 是否位于 parent 目录下（含相等）；两端路径归一化并去除尾部分隔符 */
export function isPathUnder(target: string, parent: string): boolean {
  if (!target || !parent) return false
  const t = window.preload.path.normalizePath(target).replace(/\/$/, '')
  const p = window.preload.path.normalizePath(parent).replace(/\/$/, '')
  return t === p || t.startsWith(p + '/')
}

export function isPathBlacklisted(path: string, blackList: string[]): boolean {
  return blackList.some(pattern => isPathUnder(path, pattern))
}

export function isDomainBlocked(
  hostname: string,
  blockAll: boolean,
  allowList: string[],
  rejectList: string[],
): { blocked: boolean; reason?: string } {
  const matches = (domain: string, pattern: string) =>
    domain === pattern || domain.endsWith('.' + pattern)

  if (rejectList.some(p => matches(hostname, p))) {
    return { blocked: true, reason: `域名 ${hostname} 在拒绝列表中` }
  }
  if (blockAll && !allowList.some(p => matches(hostname, p))) {
    return { blocked: true, reason: '已开启全局网络阻断，且该域名不在允许列表中' }
  }
  return { blocked: false }
}
