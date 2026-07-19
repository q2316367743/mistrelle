import OpenAI from 'openai'
import type { Ref } from 'vue'
import type {
  ChatCompletionChunk,
  ChatCompletionMessageParam
} from 'openai/resources/chat/completions'
import {
  AIMessage,
  AIMessageContent,
  ChatMessage,
  SystemMessage,
  TextContent,
  UserMessage
} from '@/domain'
import { toDateString } from '@/utils/lang'
import { nanoid } from 'nanoid'

// ==========================================
//  公共类型定义
// ==========================================

export type SSEChunkData = {
  event?: string
  data: unknown
}

export interface ChatRequestParams {
  content: string
  model: string
  baseURL: string
  apiKey?: string
  thinking?: 'enabled' | 'disabled'
  reasoning_effort?: 'high' | 'max'
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

// ==========================================
//  公共 API 接口
// ==========================================

export interface ChatAPI {
  messages: Ref<ChatMessage[]>
  status: Ref<ChatStatus>
  destroy: () => void
  init: (initialMessages?: ChatMessage[]) => void
  sendUserMessage: (requestParams: ChatRequestParams) => Promise<void>
  reaskMessage: (messageId: string, requestParams: ChatRequestParams) => Promise<void>
  rollbackBeforeMessage: (messageId: string) => void

  modifyAndReaskMessage: (
    messageId: string,
    content: string,
    requestParams: ChatRequestParams
  ) => Promise<void>
  sendSystemMessage: (msg: string) => Promise<void>
  abortChat: () => Promise<void>
  setMessages: (messages: ChatMessage[], mode?: ChatMessageSetterMode) => void
  clearMessages: () => void
}

// ==========================================
//  抽象基类
// ==========================================

export abstract class AbstractChat implements ChatAPI {
  messages = ref<ChatMessage[]>([])
  status = ref<ChatStatus>('idle')
  protected ctx: ChatContext

  constructor(options: {
    defaultMessages?: Array<ChatMessage>
    chatServiceConfig?: ChatServiceConfig
  }) {
    this.messages.value = [...(options.defaultMessages ?? [])]
    this.ctx = {
      config: { ...(options.chatServiceConfig ?? {}) },
      abortController: null,
      requestSeq: 0
    }
  }

  // ========================
  //   abstract — 子类必须实现
  // ========================

  protected abstract toApiMessages(): ChatCompletionMessageParam[]
  protected abstract handleMessageContent(mc: AIMessageContent): void
  protected abstract handleLastMessage(status: ChatMessageStatus): void
  protected abstract doStreamRequest(
    params: ChatRequestParams,
    signal: AbortSignal,
    seq: number
  ): Promise<void>

  // ========================
  //   hook — 子类可选覆写
  // ========================

  /** sendUserMessage 发送前回调（子类可在此清理工具调用状态等） */
  protected onBeforeSendUserMessage(): void {
    // 默认无操作
  }

  // ========================
  //   公共 API 实现
  // ========================

  async sendUserMessage(requestParams: ChatRequestParams): Promise<void> {
    if (
      this.status.value !== 'idle' &&
      this.status.value !== 'complete' &&
      this.status.value !== 'error'
    )
      return

    this.ctx.requestSeq++
    const seq = this.ctx.requestSeq
    this.ctx.abortController = new AbortController()
    this.onBeforeSendUserMessage()
    this.status.value = 'pending'

    const userMsg: UserMessage = {
      id: nanoid(),
      role: 'user',
      content: [
        {
          type: 'text',
          data: requestParams.content,
          status: 'complete',
          time: Date.now()
        }
      ],
      model: requestParams.model,
      thinking: requestParams.thinking,
      reasoning_effort: requestParams.reasoning_effort
    }
    this.messages.value = [...this.messages.value, userMsg]

    this.messages.value.push({
      role: 'assistant',
      content: [],
      status: 'pending',
      datetime: toDateString(null),
      id: nanoid()
    })

    try {
      await this.doStreamRequest(requestParams, this.ctx.abortController.signal, seq)
      this.handleLastMessage('complete')
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        this.status.value = 'stop'
        this.ctx.config.onComplete?.(true, requestParams)
        this.handleLastMessage('stop')
      } else {
        this.status.value = 'error'
        this.ctx.config.onError?.(err instanceof Error ? err : new Error(String(err)))
        this.handleMessageContent({
          type: 'text',
          data: err instanceof Error ? err.message : String(err),
          time: Date.now()
        })
        this.handleLastMessage('error')
      }
    }
  }

  async reaskMessage(messageId: string, requestParams: ChatRequestParams): Promise<void> {
    if (
      this.status.value !== 'idle' &&
      this.status.value !== 'complete' &&
      this.status.value !== 'error'
    )
      return

    const userIdx = this.messages.value.findIndex((m) => m.id === messageId)
    if (userIdx === -1) throw new Error('消息不存在')
    if (this.messages.value[userIdx].role !== 'user') throw new Error('该消息不是用户消息')
    const userMessage = this.messages.value[userIdx] as UserMessage

    const nextMsg = this.messages.value[userIdx + 1]
    if (nextMsg && nextMsg.role === 'assistant') {
      // 保存旧响应到 history，重用该 assistant 消息
      const asstMsg = nextMsg as AIMessage
      if (asstMsg.content && asstMsg.content.length > 0) {
        if (!asstMsg.history) asstMsg.history = []
        asstMsg.history.push([...asstMsg.content])
      }
      asstMsg.content = []
      asstMsg.status = 'pending'
      // 删除 assistant 之后的所有消息
      this.messages.value = this.messages.value.slice(0, userIdx + 2)
    } else {
      // 没有 assistant 消息，清理后续消息并新建
      this.messages.value = this.messages.value.slice(0, userIdx + 1)
      this.messages.value.push({
        role: 'assistant',
        content: [],
        status: 'pending',
        datetime: toDateString(null),
        id: nanoid()
      })
    }

    this.ctx.requestSeq++
    const seq = this.ctx.requestSeq
    this.ctx.abortController = new AbortController()
    this.onBeforeSendUserMessage()
    this.status.value = 'pending'

    try {
      await this.doStreamRequest(
        {
          ...requestParams,
          content: userMessage.content[0].data as string
        },
        this.ctx.abortController.signal,
        seq
      )
      this.handleLastMessage('complete')
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        this.status.value = 'stop'
        this.ctx.config.onComplete?.(true, requestParams)
        this.handleLastMessage('stop')
      } else {
        this.status.value = 'error'
        this.ctx.config.onError?.(err instanceof Error ? err : new Error(String(err)))
        this.handleMessageContent({
          type: 'text',
          data: err instanceof Error ? err.message : String(err),
          time: Date.now()
        })
        this.handleLastMessage('error')
      }
    }
  }

  rollbackBeforeMessage(messageId: string): void {
    if (
      this.status.value !== 'idle' &&
      this.status.value !== 'complete' &&
      this.status.value !== 'error'
    )
      return

    const userIdx = this.messages.value.findIndex((m) => m.id === messageId)
    if (userIdx === -1) throw new Error('消息不存在')
    if (this.messages.value[userIdx].role !== 'user') throw new Error('该消息不是用户消息')

    this.messages.value = this.messages.value.slice(0, userIdx)
  }

  async modifyAndReaskMessage(
    messageId: string,
    content: string,
    requestParams: ChatRequestParams
  ): Promise<void> {
    if (
      this.status.value !== 'idle' &&
      this.status.value !== 'complete' &&
      this.status.value !== 'error'
    )
      return

    const userIdx = this.messages.value.findIndex((m) => m.id === messageId)
    if (userIdx === -1) throw new Error('消息不存在')
    if (this.messages.value[userIdx].role !== 'user') throw new Error('该消息不是用户消息')

    // 替换用户消息内容
    const userMsg = this.messages.value[userIdx] as ChatMessage
    userMsg.content = [
      {
        type: 'text',
        data: content,
        status: 'complete',
        time: Date.now()
      } as TextContent
    ]

    // 删除用户消息之后的所有消息
    this.messages.value = this.messages.value.slice(0, userIdx + 1)

    // 创建新的空 assistant 消息
    this.messages.value.push({
      role: 'assistant',
      content: [],
      status: 'pending',
      datetime: toDateString(null),
      id: nanoid()
    })

    this.ctx.requestSeq++
    const seq = this.ctx.requestSeq
    this.ctx.abortController = new AbortController()
    this.onBeforeSendUserMessage()
    this.status.value = 'pending'

    try {
      await this.doStreamRequest(requestParams, this.ctx.abortController.signal, seq)
      this.handleLastMessage('complete')
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        this.status.value = 'stop'
        this.ctx.config.onComplete?.(true, requestParams)
        this.handleLastMessage('stop')
      } else {
        this.status.value = 'error'
        this.ctx.config.onError?.(err instanceof Error ? err : new Error(String(err)))
        this.handleMessageContent({
          type: 'text',
          data: err instanceof Error ? err.message : String(err),
          time: Date.now()
        })
        this.handleLastMessage('error')
      }
    }
  }

  async sendSystemMessage(msg: string): Promise<void> {
    const sysMsg: SystemMessage = {
      id: nanoid(),
      role: 'system',
      content: [
        {
          type: 'text',
          data: msg,
          status: 'complete',
          time: Date.now()
        }
      ]
    }
    this.messages.value.push(sysMsg)
  }

  async abortChat(): Promise<void> {
    if (this.ctx.abortController) {
      this.ctx.abortController.abort()
      this.ctx.abortController = null
    }
    this.status.value = 'stop'
    await this.ctx.config.onAbort?.()
  }

  init(initialMessages?: ChatMessage[]): void {
    if (initialMessages) this.messages.value = [...initialMessages]
  }

  setMessages(newMessages: ChatMessage[], mode: ChatMessageSetterMode = 'replace'): void {
    if (mode === 'replace') this.messages.value = [...newMessages]
    else if (mode === 'prepend') this.messages.value = [...newMessages, ...this.messages.value]
    else this.messages.value = [...this.messages.value, ...newMessages]
  }

  clearMessages(): void {
    this.messages.value = []
  }

  destroy(): void {
    if (this.ctx.abortController) {
      this.ctx.abortController.abort()
      this.ctx.abortController = null
    }
    this.messages.value = []
    this.status.value = 'idle'
  }
}
