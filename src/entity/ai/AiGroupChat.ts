import { useSnowflake } from '@/hooks'

/** 群聊消息类型：用户发言 / AI 成员发言 / 上下文压缩后的摘要锚点 */
export type AiGroupChatMessageType = 'user' | 'ai' | 'summary'

export type AiGroupChatMessageStatus = 'pending' | 'streaming' | 'complete' | 'stop' | 'error'

/** 用户消息片段：普通文本或被 @ 的成员标记 */
export type MessageSegment =
  | { type: 'text'; content: string }
  | { type: 'at'; roleId: string; content: string }

export interface AiGroupChatMessage {
  id: string
  type: AiGroupChatMessageType
  /** AI 消息对应成员 roleId；user / summary 无 */
  roleId?: string
  /** 发言内容（纯文本备份，用于 transcript / 压缩等兼容旧数据） */
  content: string
  /** 用户消息分段：保留原始输入顺序与 @ 标记 */
  segments?: MessageSegment[]
  /** 发言时间 */
  timestamp: number
  /** 流式输出状态 */
  status?: AiGroupChatMessageStatus
  /** 用户消息中 @ 的成员 roleId 列表 */
  mentions?: string[]
  /** 所属上下文 */
  contextId: string
}

export interface AiGroupChatContext {
  id: string
  /** 上下文创建时间 */
  startedAt: number
  /** 最近一次活动时间，用于滚动过期判断 */
  lastActivityAt: number
  /** 压缩后写入的摘要，作为新上下文锚点 */
  summary?: string
}

export interface AiGroupChat {
  discussionId: string
  messages: Array<AiGroupChatMessage>
  contexts: Array<AiGroupChatContext>
  /** 当前激活的上下文 id */
  activeContextId: string
  /** 上下文过期小时数，默认 2 */
  contextExpiryHours: number
  /** 逻辑清空时间戳：该时间之前的消息视为已清空（仅界面隐藏，数据保留） */
  clearedAt?: number
}

export const DEFAULT_CONTEXT_EXPIRY_HOURS = 2

export const buildAiGroupChat = (discussionId: string): AiGroupChat => {
  const contextId = useSnowflake().nextId()
  const now = Date.now()
  return {
    discussionId,
    messages: [],
    contexts: [{ id: contextId, startedAt: now, lastActivityAt: now }],
    activeContextId: contextId,
    contextExpiryHours: DEFAULT_CONTEXT_EXPIRY_HOURS
  }
}

/** 按天记忆单条记录 */
export interface AiGroupChatMemoryEntry {
  time: number
  content: string
}

export interface AiGroupChatMemory {
  date: string
  entries: Array<AiGroupChatMemoryEntry>
}
