import { BaseEntity } from '@/entity'
import { ChatMessage } from '@/domain'

/**
 * 第一次的消息
 */
export interface AiChatForm {
  content: string
  model: string
  thinking?: 'enabled' | 'disabled'
  reasoning_effort?: 'high' | 'max'
}

/**
 * AI 消息记录
 */
export interface AiChatItem extends BaseEntity {
  name: string
  // 是否置顶
  top: boolean
  // 第一次的信息
  form: AiChatForm
}

export interface AiChatContent {
  /**
   * 更新时间
   */
  updatedTime: number
  messages: Array<ChatMessage>
}

export interface AiChat extends AiChatItem, AiChatContent {}
