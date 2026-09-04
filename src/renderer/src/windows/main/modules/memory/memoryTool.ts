import type { ToolFunction } from '@/domain'
import { toDateKey, toTimeKey } from './MemoryConstant'
import { appendDayMemory, readSoulState } from './MemoryService'

const MEMORY_CATEGORIES = ['fact', 'preference', 'progress', 'lesson'] as const

/**
 * record_memory 工具：对话中主动记录重要信息到当日短期记忆（夜间整理进长期记忆）。
 * 写入受控的 soul 目录且无路径参数，标记 safe 全模式免审批（与 update_todo 同级）。
 */
export const recordMemoryTool: ToolFunction = {
  name: 'record_memory',
  label: '记录记忆',
  description:
    '将值得长期记住的用户信息写入当日短期记忆（每日夜间自动整理进长期记忆）。用户明确要求「记住」某事，或你察觉到重要的用户偏好、对既有做法的纠正、项目关键事实、本次协作的教训时调用。单条一句话，只记对未来对话有价值的信息。',
  parameters: {
    type: 'object',
    properties: {
      content: { type: 'string', description: '记忆条目，一句话描述（可带日期标注）' },
      category: {
        type: 'string',
        description: '条目分类',
        enum: [...MEMORY_CATEGORIES]
      }
    },
    required: ['content', 'category']
  },
  risk: 'safe',
  handler: async (...params: unknown[]) => {
    const { content, category } = params[0] as { content?: unknown; category?: unknown }
    const text = typeof content === 'string' ? content.trim() : ''
    if (!text) return { error: '记忆内容（content）不能为空' }
    if (text.length > 200) return { error: '单条记忆过长（≤200 字），请精炼后提交' }
    if (typeof category !== 'string' || !MEMORY_CATEGORIES.includes(category as never)) {
      return { error: `非法分类 ${String(category)}，仅支持 ${MEMORY_CATEGORIES.join(' / ')}` }
    }
    const state = await readSoulState()
    if (!state.memoryEnabled) return { error: '记忆系统未启用（设置-记忆 中可开启）' }
    await appendDayMemory(
      toDateKey(),
      [`- [${toTimeKey()}] [${category}]（对话记录）${text}`]
    )
    return { message: '已记入当日记忆，将在夜间整理进长期记忆' }
  }
}
