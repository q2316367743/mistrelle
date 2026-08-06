import type { ThinkingEffort } from '@/domain'
import { AiChatMode } from '@/entity'
import type { ChatType, WritingScene } from '@/modules/chat'

/**
 * LChatSender 初始化参数：由父组件在挂载时一次性提供，
 * 之后仅在对象引用变化（异步水合 / 恢复上次会话配置）时整体应用。
 */
export interface ChatSenderInitial {
  input?: string
  model?: string
  thinking?: boolean
  effort?: ThinkingEffort
  agentId?: string
  mode?: AiChatMode
  type?: ChatType
  writingScene?: WritingScene
  workspace?: string
}
