function normalizePath(path: string): string {
  return path.replace(/^~/, window.preload.inject.os.getPath('home'))
}

function isSubPath(target: string, parent: string): boolean {
  const t = normalizePath(target).replace(/\/$/, '')
  const p = normalizePath(parent).replace(/\/$/, '')
  return t === p || t.startsWith(p + '/')
}

export function isPathBlacklisted(path: string, blackList: string[]): boolean {
  return blackList.some(pattern => isSubPath(path, pattern))
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
