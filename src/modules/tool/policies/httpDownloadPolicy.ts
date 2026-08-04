import type { ToolPolicy } from '@/modules/tool'

function isPathUnder(target: string, parent: string): boolean {
  if (!target || !parent) return false
  const t = window.preload.path.normalizePath(target).replace(/\/$/, '')
  const p = window.preload.path.normalizePath(parent).replace(/\/$/, '')
  return t === p || t.startsWith(p + '/')
}

/**
 * http_download 审批策略：
 * - 保存路径位于沙盒或工作空间（可信区）→ 自动放行，不弹窗
 * - 其他目录 → 需用户审批（走 confirm 交互 UI）
 */
export const httpDownloadPolicy: ToolPolicy = {
  name: 'http_download',
  resolve(_tool, args, ctx) {
    const path = args.path
    if (typeof path !== 'string' || !path) return 'ask'
    return isPathUnder(path, ctx.sandboxDir) || isPathUnder(path, ctx.workspace) ? 'allow' : 'ask'
  }
}
