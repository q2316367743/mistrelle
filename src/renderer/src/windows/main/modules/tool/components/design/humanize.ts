/**
 * humanize_text 工具：把 AI 腔明显的文案改写得自然、像人写。
 * - 与写作侧边栏「去 AI 味」同源：经 window.preload.relay.rewriteStream → 服务端 /api/rewrite SSE，
 *   渲染层客户端见 modules/ai/humanize.ts。
 * - 仅登录后注入（服务端需登录鉴权，未登录调用返回错误），与提示词门控同源。
 * - 设计创意场景用途：海报 / 卡片里的标题与正文文案若空泛对仗、堆砌形容词，改写后再排版。
 */
import type { ToolFunction } from '@/domain'
import { useAuthStore } from '@/windows/main/store/AuthStore'
import { requestHumanizeStream } from '@/windows/main/modules/ai/humanize'

/** 去 AI 味能力门控：服务端需登录鉴权 */
export const hasHumanizeAccess = (): boolean => useAuthStore().status === 'signed-in'

const MIN_DEPTH = 1
const MAX_DEPTH = 10
const DEFAULT_DEPTH = 5

/** 深度钳制到 1~10（缺省 / 非法值回退默认 5） */
const clampDepth = (value: unknown): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : DEFAULT_DEPTH
  return Math.min(MAX_DEPTH, Math.max(MIN_DEPTH, n))
}

export const createHumanizeTool = (): ToolFunction => ({
  name: 'humanize_text',
  label: '去 AI 味',
  description:
    '把一段文案改写得自然、像人写，去掉 AI 腔（空泛对仗、堆砌形容词、"不仅仅是…更是…"、滥用排比 / 破折号等）。' +
    '返回改写后的文本（content），直接替换到设计稿的文字节点 / 文字元素即可。' +
    'depth 1~10 控制改写力度（缺省 5，越大越彻底）。只改写文案本身，不改变设计结构。需要已登录账号。',
  parameters: {
    type: 'object',
    properties: {
      content: { type: 'string', description: '需要去 AI 味的文案原文（可含多行）' },
      depth: { type: 'integer', description: '改写力度 1~10 的整数（缺省 5，越界自动钳制）' }
    },
    required: ['content']
  },
  risk: 'safe',
  handler: async (...params: unknown[]) => {
    const { content, depth } = params[0] as { content?: string; depth?: number }
    if (!content?.trim()) return { error: '缺少 content：请输入需要去 AI 味的文案' }
    if (!hasHumanizeAccess()) return { error: '未登录：请先登录后再使用去 AI 味' }
    const d = clampDepth(depth)
    try {
      const text = await requestHumanizeStream({ text: content, depth: d })
      return {
        success: true,
        content: text,
        depth: d,
        length: text.replace(/\s+/g, '').length
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }
})
