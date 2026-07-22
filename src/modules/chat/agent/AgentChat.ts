import type {
  ChatCompletionMessageParam,
  ChatCompletionTool
} from 'openai/resources/chat/completions'
import type {
  AIMessage,
  ChatMessage,
  ToolFunction,
  UserMessage,
  UserMessageContent
} from '@/domain'
import { nanoid } from 'nanoid'
import { skillTools, buildSkillDynamicPrompt } from '@/modules/skill'
import { defaultTools } from '@/modules/tool'
import type {
  ChatContext,
  ChatMessageSetterMode,
  ChatRequestParams,
  ChatServiceConfig,
  ChatStatus
} from '@/modules/chat'
import { toAgentRequestMessages } from './agentContext'
import {
  appendAssistantContent,
  createPendingAssistantMessage,
  setAssistantStatus
} from './agentMessages'
import { streamAgentStep } from './agentStream'
import { executeToolCalls } from './agentTools'
import type { ToolCall } from './agentTypes'

export interface UseChatOptions {
  defaultMessages?: ChatMessage[]
  chatServiceConfig?: ChatServiceConfig
  functions?: ToolFunction[]
  enableSkill?: boolean
  systemPrompt?: string
  toolConfirmHandler?: (toolName: string, args: Record<string, unknown>) => Promise<boolean>
}

export type UseChatResult = ToolChat & {
  getToolcallByName: (name: string) => ToolCall | undefined
}

export class ToolChat {
  readonly messages = ref<ChatMessage[]>([])
  readonly status = ref<ChatStatus>('idle')
  readonly toolCalls = ref<ToolCall[]>([])
  private readonly ctx: ChatContext
  private readonly functions: ToolFunction[]
  private readonly enableSkill: boolean
  private readonly systemPrompt: string
  private readonly toolConfirmHandler?: UseChatOptions['toolConfirmHandler']

  constructor(options: UseChatOptions) {
    this.messages.value = [...(options.defaultMessages ?? [])]
    this.ctx = {
      config: { ...(options.chatServiceConfig ?? {}) },
      abortController: null,
      requestSeq: 0
    }
    this.functions = options.functions ?? []
    this.enableSkill = options.enableSkill ?? true
    this.systemPrompt = options.systemPrompt ?? ''
    this.toolConfirmHandler = options.toolConfirmHandler
  }

  private getFunctions(): ToolFunction[] {
    return this.enableSkill ? [...this.functions, ...defaultTools, ...skillTools] : this.functions
  }

  private buildTools(functions: ToolFunction[]): ChatCompletionTool[] {
    return functions.map((fn) => ({
      type: 'function',
      function: {
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters
      }
    }))
  }

  private async buildRequestMessages(
    assistantMessageId: string
  ): Promise<ChatCompletionMessageParam[]> {
    const dynamicPrompt = this.enableSkill ? await buildSkillDynamicPrompt(this.messages.value) : ''
    const systemPrompt = [this.systemPrompt, dynamicPrompt].filter(Boolean).join('\n\n')
    const messages = toAgentRequestMessages(this.messages.value, assistantMessageId)
    return systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages
  }

  /** 在同一个 assistant 聊天记录中循环请求模型并执行工具。 */
  private async runAgentLoop(
    params: ChatRequestParams,
    assistantMessageId: string,
    signal: AbortSignal,
    seq: number
  ): Promise<void> {
    const functions = this.getFunctions()
    const tools = this.buildTools(functions)
    this.status.value = 'streaming'

    while (seq === this.ctx.requestSeq && !signal.aborted) {
      const result = await streamAgentStep({
        messages: this.messages,
        assistantMessageId,
        requestParams: params,
        apiMessages: await this.buildRequestMessages(assistantMessageId),
        tools,
        config: this.ctx.config,
        signal,
        seq,
        currentSeq: () => this.ctx.requestSeq
      })
      if (result.cancelled) return
      if (result.toolCalls.length === 0) {
        this.status.value = result.finishReason === 'length' ? 'stop' : 'complete'
        this.ctx.config.onComplete?.(false, params)
        return
      }

      this.toolCalls.value.push(...result.toolCalls)
      await executeToolCalls(
        this.messages,
        assistantMessageId,
        result.toolCalls,
        functions,
        this.toolConfirmHandler
      )
      this.toolCalls.value = [...this.toolCalls.value]
      await nextTick()
    }
  }

  private canStartRequest(): boolean {
    return ['idle', 'complete', 'error', 'stop'].includes(this.status.value)
  }

  private beginRequest(): { seq: number; signal: AbortSignal } {
    this.ctx.requestSeq += 1
    this.ctx.abortController = new AbortController()
    this.toolCalls.value = []
    this.status.value = 'pending'
    return {
      seq: this.ctx.requestSeq,
      signal: this.ctx.abortController.signal
    }
  }

  private async executeRequest(
    requestParams: ChatRequestParams,
    assistantMessageId: string
  ): Promise<void> {
    const { seq, signal } = this.beginRequest()
    try {
      await this.runAgentLoop(requestParams, assistantMessageId, signal, seq)
      if (seq === this.ctx.requestSeq && !signal.aborted) {
        const status = this.status.value === 'idle' ? 'complete' : this.status.value
        setAssistantStatus(this.messages, assistantMessageId, status)
      }
    } catch (error: unknown) {
      this.handleRequestError(error, requestParams, assistantMessageId)
    }
  }

  private handleRequestError(
    error: unknown,
    requestParams: ChatRequestParams,
    assistantMessageId: string
  ): void {
    if (error instanceof Error && error.name === 'AbortError') {
      this.status.value = 'stop'
      this.ctx.config.onComplete?.(true, requestParams)
      setAssistantStatus(this.messages, assistantMessageId, 'stop')
      return
    }

    this.status.value = 'error'
    this.ctx.config.onError?.(error instanceof Error ? error : new Error(String(error)))
    appendAssistantContent(this.messages, assistantMessageId, {
      type: 'text',
      data: error instanceof Error ? error.message : String(error),
      time: Date.now()
    })
    setAssistantStatus(this.messages, assistantMessageId, 'error')
  }

  async sendUserMessage(requestParams: ChatRequestParams): Promise<void> {
    if (!this.canStartRequest()) return
    const userMessage: UserMessage = {
      id: nanoid(),
      role: 'user',
      content: requestParams.content,
      model: requestParams.model,
      provide: requestParams.provide,
      thinking: requestParams.thinking,
      reasoning_effort: requestParams.reasoning_effort,
      ext: requestParams.referenceContext
        ? { referenceContext: requestParams.referenceContext }
        : undefined
    }
    const assistantMessage = createPendingAssistantMessage()
    this.messages.value = [...this.messages.value, userMessage, assistantMessage]
    await this.executeRequest(requestParams, assistantMessage.id)
  }

  async reaskMessage(messageId: string, requestParams: ChatRequestParams): Promise<void> {
    if (!this.canStartRequest()) return
    const userIndex = this.getUserMessageIndex(messageId)
    const userMessage = this.messages.value[userIndex]
    if (userMessage.role !== 'user') return
    const nextMessage = this.messages.value[userIndex + 1]
    let assistantMessage: AIMessage
    if (nextMessage?.role === 'assistant') {
      assistantMessage = nextMessage
      if (assistantMessage.content?.length) {
        ;(assistantMessage.history ??= []).push([...assistantMessage.content])
      }
      assistantMessage.content = []
      assistantMessage.status = 'pending'
      this.messages.value = this.messages.value.slice(0, userIndex + 2)
    } else {
      assistantMessage = createPendingAssistantMessage()
      this.messages.value = [...this.messages.value.slice(0, userIndex + 1), assistantMessage]
    }
    await this.executeRequest(
      { ...requestParams, content: userMessage.content },
      assistantMessage.id
    )
  }

  rollbackBeforeMessage(messageId: string): void {
    if (!this.canStartRequest()) return
    this.messages.value = this.messages.value.slice(0, this.getUserMessageIndex(messageId))
  }

  async modifyAndReaskMessage(
    messageId: string,
    content: UserMessageContent[],
    requestParams: ChatRequestParams
  ): Promise<void> {
    if (!this.canStartRequest()) return
    const userIndex = this.getUserMessageIndex(messageId)
    const userMessage = this.messages.value[userIndex]
    if (userMessage.role !== 'user') return
    userMessage.content = content
    const assistantMessage = createPendingAssistantMessage()
    this.messages.value = [...this.messages.value.slice(0, userIndex + 1), assistantMessage]
    await this.executeRequest({ ...requestParams, content }, assistantMessage.id)
  }

  private getUserMessageIndex(messageId: string): number {
    const index = this.messages.value.findIndex((message) => message.id === messageId)
    if (index < 0) throw new Error('消息不存在')
    if (this.messages.value[index].role !== 'user') throw new Error('该消息不是用户消息')
    return index
  }

  async abortChat(): Promise<void> {
    this.ctx.abortController?.abort()
    this.ctx.abortController = null
    this.status.value = 'stop'
    await this.ctx.config.onAbort?.()
  }

  init(initialMessages?: ChatMessage[]): void {
    if (initialMessages) this.messages.value = [...initialMessages]
  }

  setMessages(messages: ChatMessage[], mode: ChatMessageSetterMode = 'replace'): void {
    if (mode === 'replace') this.messages.value = [...messages]
    else if (mode === 'prepend') this.messages.value = [...messages, ...this.messages.value]
    else this.messages.value = [...this.messages.value, ...messages]
  }

  clearMessages(): void {
    this.messages.value = []
  }

  getToolcallByName(name: string): ToolCall | undefined {
    return this.toolCalls.value.find((call) => call.toolCallName === name)
  }

  destroy(): void {
    this.ctx.abortController?.abort()
    this.ctx.abortController = null
    this.messages.value = []
    this.status.value = 'idle'
    this.toolCalls.value = []
  }
}
