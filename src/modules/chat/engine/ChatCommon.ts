import OpenAI from 'openai'
import type { ChatCompletionChunk } from 'openai/resources/chat/completions'
import type { AIMessageContent, UserMessage } from '@/domain'

// ==========================================
//  公共类型定义
// ==========================================

export type SSEChunkData = {
  event?: string
  data: unknown
}

export interface ChatRequestParams
  extends Omit<UserMessage, 'id' | 'role' | 'datetime' | 'ext'> {
  baseURL: string
  apiKey?: string
  referenceContext?: string
}

export interface ChatServiceConfig {
  stream?: boolean
  retryInterval?: number
  maxRetries?: number
  timeout?: number
  onRequest?: (
    params: ChatRequestParams
  ) => (ChatRequestParams & RequestInit) | Promise<ChatRequestParams & RequestInit>
  onStart?: (chunk: string) => void
  isValidChunk?: (chunk: SSEChunkData) => boolean
  onComplete?: (
    isAborted: boolean,
    params?: ChatRequestParams,
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
