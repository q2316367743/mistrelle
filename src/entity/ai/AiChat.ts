import { BaseEntity } from '@/entity'
import { ChatMessage } from '@/domain'
import { ChatRequestParams } from '@/modules/chat'

/**
 * 聊天索引中的轻量元信息（index.json）
 */
export interface AiChatItem extends BaseEntity {
  name: string
  // 是否置顶
  top: boolean
  // 首条消息纯文本预览，供列表展示
  preview?: string
  // 模型 key（${provideId}:${identifier}），供列表展示
  previewModel?: string
  // 所属项目
  projectId?: string
  // 所属任务
  taskId?: string
}

/**
 * 待发送的首条消息草稿（chat.json）
 */
export interface AiChatDraft {
  params: ChatRequestParams
  workspace: string
}

export interface AiChatContent {
  /**
   * 更新时间
   */
  updatedTime: number
  // 待发送的首条消息草稿
  draft?: ChatRequestParams

  // 工作空间，用户可以指定
  workspace: string
  messages: Array<ChatMessage>
}

export interface AiChat extends AiChatItem, AiChatContent {}
