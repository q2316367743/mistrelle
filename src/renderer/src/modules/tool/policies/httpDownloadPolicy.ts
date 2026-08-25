import type { ToolPolicy } from '@/modules/tool/toolPolicyTypes'
import { isPathUnder } from '@/utils/sandbox'

/**
 * http_download 审批策略：
 * - 保存路径位于沙盒、工作空间或聊天白名单目录（可信区）→ 自动放行，不弹窗
 * - 其他目录 → 需用户审批（走 confirm 交互 UI）
 */
export const httpDownloadPolicy: ToolPolicy = {
  name: 'http_download',
  resolve(_tool, args, ctx) {
    const path = args.path
    if (typeof path !== 'string' || !path) return 'ask'
    const inChatAllowList = ctx.allowedDirs?.some((dir) => isPathUnder(path, dir)) ?? false
    return isPathUnder(path, ctx.sandboxDir) || isPathUnder(path, ctx.workspace) || inChatAllowList
      ? 'allow'
      : 'ask'
  }
}
