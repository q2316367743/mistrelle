import type { AiStreamChunk } from '@/modules/ai'
import type { AIMessageContent, ThinkingEffort, UserMessageContent } from '@/domain'
import { AiChatMode, AiProvideFormat } from '@/entity'
import type { AiModelSupport } from '@/entity'
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
  // 隐私聊天：不注入记忆、不注册记忆工具，会话不进入记忆提取（仅创建时生效，创建后锁定；持久化在 chat 表 privacy 列）
  privacy?: boolean
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
  /** 模型能力位（识图时用户引用的图片随请求传递） */
  support?: AiModelSupport[]
  /**
   * 内置供应商（服务端中转站）标记：请求走主进程 relay IPC（注入服务端 apiKey + session_id），
   * 不直连第三方 baseURL；baseURL/apiKey 在此场景下为占位值。
   */
  builtin?: boolean
  /** 内置供应商中转会话 id（透传 session_id，作渠道亲和键；缺省服务端回退 user / 用户 id） */
  sessionId?: string
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
  // 部分网关思考增量字段名为 reasoning（语义同 reasoning_content），缺失思考会导致
  // 工具调用轮次无法回传 reasoning_content，被 DeepSeek/GLM 以 400 拒绝
  return delta.reasoning_content ?? delta.reasoning
}

export function finishReasonToStatus(reason: string | null | undefined): ChatMessageStatus {
  if (reason === 'stop') return 'complete'
  if (reason === 'length') return 'stop'
  return 'streaming'
}
