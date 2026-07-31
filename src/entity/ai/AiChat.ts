import { BaseEntity } from '@/entity'
import { ChatMessage } from '@/domain'
import type { ChatRequestParams } from '@/modules/chat'

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
export type AiChatDraft = ChatRequestParams

/**
 * 聊天模式
 * - 0：默认模式（工具审批受限于工具自身权限：safe 放行、sensitive 需确认、dangerous 拦截）
 * - 1：计划模式（无写入 / 修改权限，shell 执行需审批，只读 / 分析类可用）
 * - 2：完全访问模式（默认直接放行一切，仅当操作命中安全中心黑名单时才需审批）
 *
 * 三种模式均无法跳过安全中心设置：一旦工具命中黑名单（写入指定目录、shell 含指定目录字符串、shell 命中指定命令），均需审批。
 */
export type AiChatMode = 0 | 1 | 2

export interface AiChatContent {
  /**
   * 更新时间
   */
  updatedTime: number
  // 待发送的首条消息草稿
  draft?: ChatRequestParams
  // 当前对话选中的 agent
  agentId: string
  // 工作空间，用户可以指定
  workspace: string
  mode: AiChatMode
  messages: Array<ChatMessage>
}

export interface AiChat extends AiChatItem, AiChatContent {}
