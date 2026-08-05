import type { ChatType } from '@/modules/chat/chatType'
import type { SubAgentType } from './types'

/**
 * 子 Agent 能力类型 → 聊天场景（决定其注入的场景工具）。
 * - research：无场景工具（只读调研）
 * - design：映射到设计场景 → 注入画布（canvas_*）工具
 * 新增能力类型只需在此扩展。
 */
export const SUB_AGENT_SCENE: Record<SubAgentType, ChatType | undefined> = {
  research: undefined,
  design: 'design'
}
