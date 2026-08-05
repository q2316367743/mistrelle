import type { ChatMessage, TextContent } from '@/domain'
import { MAX_SUB_AGENT_STEPS } from '@/global/Constant'

/**
 * 从消息列表末尾向前查找最后一条 assistant 消息的文本内容作为摘要。
 * 子 Agent 触顶（hitMaxSteps）未正常收尾时，返回明确的未完成标记，而不是把过程叙述当摘要返回给主 Agent。
 * 触顶但收尾成功（reachedMaxSteps 为 true）时，在摘要末尾追加触顶备注，提示结论可能未完全覆盖。
 */
export const extractFinalSummary = (
  messages: ChatMessage[],
  hitMaxSteps: boolean,
  reachedMaxSteps: boolean
): string => {
  if (hitMaxSteps) {
    return `[子 Agent 已连续执行 ${MAX_SUB_AGENT_STEPS} 步仍未完成任务，未输出最终摘要。主 Agent 可基于其中间结果自行收尾，或缩小任务范围后重新派发。]`
  }
  let summary = '(子 Agent 未产生有效文本输出)'
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'assistant' || !msg.content) continue
    const texts = msg.content
      .filter((c): c is TextContent => c.type === 'text' || c.type === 'markdown')
      .map((c) => c.data)
      .join('')
    if (texts.trim()) {
      summary = texts.trim()
      break
    }
  }
  if (summary === '(子 Agent 未产生有效文本输出)') return summary
  return reachedMaxSteps
    ? `${summary}\n\n> 注：本次任务已达到步数上限，结论由子 Agent 即时总结，可能未完全覆盖。`
    : summary
}
