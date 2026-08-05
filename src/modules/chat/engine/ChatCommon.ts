import OpenAI from 'openai'
import type { ChatCompletionChunk } from 'openai/resources/chat/completions'
import type { AIMessageContent, UserMessageContent } from '@/domain'
import { AiChatMode } from '@/entity'
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
    reasoning_effort?: 'high' | 'max'
  }
  // 模式
  mode: AiChatMode
  agentId?: string
  workspace?: string
  // 聊天类型（新建对话时选定，创建后锁定；缺省回退 office）
  type?: ChatType
  // 写作子场景（仅 article，writing 类型默认场景），新建对话时选定，创建后锁定；缺省回退 article
  writingScene?: WritingScene
}

export interface ResolvedChatRequestParams extends ChatRequestParams {
  baseURL: string
  apiKey?: string
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

export function createClient(baseURL: string, apiKey?: string): OpenAI {
  return new OpenAI({
    baseURL,
    apiKey,
    dangerouslyAllowBrowser: true
  })
}

export function extractReasoningContent(
  delta: ChatCompletionChunk.Choice.Delta
): string | undefined {
  return (delta as Record<string, unknown>).reasoning_content as string | undefined
}

export function finishReasonToStatus(reason: string | null | undefined): ChatMessageStatus {
  if (reason === 'stop') return 'complete'
  if (reason === 'length') return 'stop'
  return 'streaming'
}
