// ==========================================
//  AIHOT 请求异常统一处理
//  约定来源：https://aihot.virxact.com/agent?tab=api
//  - 429/503 按 Retry-After 提示重试间隔
//  - 409 = selected/changes 游标失效（snapshot_required）
//  - 400 = items invalid_cursor（窗口滑动失效，应从第一页重来）
// ==========================================
import { MessageUtil } from '@/utils/modal'

interface AihotRequestErrorShape {
  response?: { status?: number; headers?: Record<string, unknown> }
}

/** 读取请求异常的 HTTP 状态码 */
export const aihotErrorStatus = (e: unknown): number | undefined => {
  return (e as AihotRequestErrorShape | null)?.response?.status
}

/** 是否 400：items 游标因窗口滑动失效（invalid_cursor），按文档应从第一页重来 */
export const isAihotBadRequest = (e: unknown): boolean => aihotErrorStatus(e) === 400

/**
 * 请求异常统一提示：
 * - 429/503 携带 Retry-After 时提示具体秒数（文档：遵守 Retry-After）
 * - 400 / 404 给出语义化文案；其余走 fallback + 原始错误信息
 */
export const aihotNotifyError = (fallback: string, e: unknown): void => {
  const status = aihotErrorStatus(e)
  if (status === 429 || status === 503) {
    const shape = e as AihotRequestErrorShape | null
    const headers = shape?.response?.headers ?? {}
    const retryAfter = Number(headers['retry-after'] ?? headers['Retry-After'])
    MessageUtil.error(
      Number.isFinite(retryAfter) && retryAfter > 0
        ? `请求过于频繁，请 ${Math.ceil(retryAfter)} 秒后再试`
        : '请求过于频繁，请稍后再试'
    )
    return
  }
  if (status === 404) {
    MessageUtil.error('内容不存在或已下线')
    return
  }
  if (status === 400) {
    MessageUtil.error('查询已过期，请刷新后重试')
    return
  }
  MessageUtil.error(fallback, e)
}
