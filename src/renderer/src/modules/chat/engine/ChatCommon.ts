import type { AiStreamChunk } from '@/modules/ai'
import type { AIMessageContent, ThinkingEffort, UserMessageContent } from '@/domain'
import { AiChatMode, AiProvideFormat } from '@/entity'
import type { ChatType, WritingScene } from '@/modules/chat'

// ==========================================
//  公共类型定义
// ==========================================

export type SSEChunkData = {
  event?: string
  data: unknown
}

export interface ChatRequestParams {
  message: {
    content: UserMessageContent[]
    model: string
    provide: string
    // 是否启用思考模式
    thinking?: boolean
    // 思考强度
    reasoning_effort?: ThinkingEffort
  }
  // 模式
  mode: AiChatMode
  agentId?: string
  workspace?: string
  // 聊天类型（新建对话时选定，创建后锁定；缺省回退 office）
  type?: ChatType
  // 写作子场景（仅 article，writing 类型默认场景），新建对话时选定，创建后锁定；缺省回退 article
  writingScene?: WritingScene
  // 设计风格 id（design 类型），新建对话时选定，创建后锁定；缺省无
  designStyleId?: string
}

export interface ResolvedChatRequestParams extends ChatRequestParams {
  baseURL: string
  apiKey?: string
  /** API 格式（chat / responses / anthropic），决定请求体与流式解析方式；缺省 chat */
  format?: AiProvideFormat
}

/** onRequest 可返回的请求覆盖项；刻意不含 fetch 的 `mode` 等会与 chat 字段冲突的项 */
export type ChatRequestOverride = {
  body?: Record<string, unknown>
  headers?: HeadersInit
}

export interface ChatServiceConfig {
  stream?: boolean
  retryInterval?: number
  maxRetries?: number
  timeout?: number
  onRequest?: (
    params: ResolvedChatRequestParams
  ) =>
    | (Partial<ResolvedChatRequestParams> & ChatRequestOverride)
    | Promise<Partial<ResolvedChatRequestParams> & ChatRequestOverride>
  onStart?: (chunk: string) => void
  isValidChunk?: (chunk: SSEChunkData) => boolean
  onComplete?: (
    isAborted: boolean,
    params?: ResolvedChatRequestParams,
    result?: unknown
  ) => AIMessageContent | AIMessageContent[] | void
  onAbort?: () => Promise<void>
  onError?: (err: Error | Response) => void
}

export type ChatMessageStatus = 'pending' | 'streaming' | 'complete' | 'stop' | 'error'

export type ChatStatus = 'idle' | ChatMessageStatus

export type ChatMessageSetterMode = 'replace' | 'prepend' | 'append'

// ==========================================
//  公共内部状态上下文
// ==========================================

export interface ChatContext {
  config: ChatServiceConfig
  abortController: AbortController | null
  requestSeq: number
}

// ==========================================
//  纯工具函数
// ==========================================

export function extractReasoningContent(
  delta: NonNullable<AiStreamChunk['choices']>[number]['delta']
): string | undefined {
  return delta.reasoning_content
}

export function finishReasonToStatus(reason: string | null | undefined): ChatMessageStatus {
  if (reason === 'stop') return 'complete'
  if (reason === 'length') return 'stop'
  return 'streaming'
}
