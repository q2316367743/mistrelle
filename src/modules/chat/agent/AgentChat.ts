import type {
  ChatCompletionMessageParam,
  ChatCompletionTool
} from 'openai/resources/chat/completions'
import type {
  AIMessage,
  AttachmentContent,
  ChatMessage,
  ToolContent,
  ToolFunction,
  UserMessage,
  UserMessageContent
} from '@/domain'
import { nanoid } from 'nanoid'
import { buildSkillDynamicPrompt } from '@/modules/skill'
import { buildAiAgentPrompt } from '@/entity/ai'
import { defaultTools, getMcpTools, toolMap } from '@/modules/tool'
import { useAiAgentStore, useSettingAiStore } from '@/store'
import type {
  ChatContext,
  ChatMessageSetterMode,
  ChatRequestParams,
  ChatServiceConfig,
  ChatStatus,
  ResolvedChatRequestParams
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
import { copyToInputs, isPathUnder } from '@/utils/chatSender'

export interface UseChatOptions {
  defaultMessages?: ChatMessage[]
  chatServiceConfig?: ChatServiceConfig
  functions?: ToolFunction[]
  systemPrompt?: string
  toolConfirmHandler?: (toolName: string, args: Record<string, unknown>) => Promise<boolean>
  enableSkill?: boolean
  sandboxDir?: string
  workspace?: string
}

export class ToolChat {
  readonly messages = ref<ChatMessage[]>([])
  readonly status = ref<ChatStatus>('idle')
  readonly toolCalls = ref<ToolCall[]>([])
  private readonly ctx: ChatContext
  private readonly functions: ToolFunction[]
  private readonly systemPrompt: string
  private readonly toolConfirmHandler?: UseChatOptions['toolConfirmHandler']
  private sandboxDir = ''
  private workspace = ''

  constructor(options: UseChatOptions = {}) {
    this.messages.value = [...(options.defaultMessages ?? [])]
    this.ctx = {
      config: { ...(options.chatServiceConfig ?? {}) },
      abortController: null,
      requestSeq: 0
    }
    this.functions = options.functions ?? []
    this.systemPrompt = options.systemPrompt ?? ''
    this.toolConfirmHandler = options.toolConfirmHandler
    if (options.sandboxDir) this.sandboxDir = options.sandboxDir
    if (options.workspace) this.workspace = options.workspace
  }

  private async resolveModel(params: ChatRequestParams): Promise<ResolvedChatRequestParams> {
    const store = useSettingAiStore()
    if (!store.ready) await store.initPromise
    const option = store.optionMap.get(`${params.message.provide}:${params.message.model}`)
    if (!option) throw new Error('模型不存在或未启用，请在 AI 设置中配置。')
    return {
      ...params,
      baseURL: option.baseUrl,
      apiKey: option.key
    }
  }

  private getUserToolNames(params: ChatRequestParams): string[] {
    return params.message.content
      .filter((content): content is ToolContent => content.type === 'tool')
      .map((content) => content.data.name)
  }

  private getFunctions(params: ChatRequestParams): ToolFunction[] {
    const agent = params.message.agentId ? useAiAgentStore().getById(params.message.agentId) : undefined
    const names = [...(agent?.tools ?? []), ...this.getUserToolNames(params)]
    const selected = names.map((name) => toolMap[name]).filter((fn): fn is ToolFunction => !!fn)
    const mcpTools = getMcpTools()
    const map = new Map<string, ToolFunction>()
    for (const fn of [...this.functions, ...selected, ...defaultTools, ...mcpTools]) {
      map.set(fn.name, fn)
    }
    return Array.from(map.values())
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

  private buildWorkspacePrompt(): string {
    const parts: string[] = ['## 文件系统']
    if (this.sandboxDir) {
      parts.push(`- 沙盒目录：${this.sandboxDir}`)
      parts.push(`  - inputs/：用户引入的附件文件`)
      parts.push(`  - outputs/：你的产出文件（无工作空间时的默认输出位置）`)
      parts.push(`  - tmp/：临时文件目录`)
    }
    if (this.workspace) {
      parts.push(`- 用户工作空间：${this.workspace}`)
      parts.push(`  最终交付物优先写入工作空间。`)
    } else {
      parts.push(`- 用户工作空间：（无）`)
    }
    parts.push(`用户消息中引用的文件路径为绝对路径，可直接读取。`)
    return parts.join('\n')
  }

  private buildReferenceContext(): string {
    const lastUserMessage = [...this.messages.value].reverse().find((m) => m.role === 'user')
    if (!lastUserMessage || lastUserMessage.role !== 'user') return ''
    const contents = lastUserMessage.content
    const attachments = contents
      .filter((content): content is AttachmentContent => content.type === 'attachment')
      .flatMap((content) => content.data)
    if (attachments.length === 0) return ''
    const parts = attachments.map((item) => `## File: ${item.name ?? item.url}\n路径：${item.url}\n`)
    return `\n\n---\n以下是用户在输入框中引用的上下文，请结合这些内容回答：\n\n${parts.join('\n---\n')}`
  }

  private async buildRequestMessages(
    params: ChatRequestParams,
    assistantMessageId: string
  ): Promise<ChatCompletionMessageParam[]> {
    const agent = params.message.agentId ? useAiAgentStore().getById(params.message.agentId) : undefined
    const agentPrompt = agent ? buildAiAgentPrompt(agent) : ''
    const dynamicPrompt = await buildSkillDynamicPrompt(this.messages.value)
    const workspacePrompt = this.buildWorkspacePrompt()
    const systemPrompt = [this.systemPrompt, agentPrompt, dynamicPrompt, workspacePrompt].filter(Boolean).join('\n\n')
    const messages = toAgentRequestMessages(
      this.messages.value,
      assistantMessageId,
      this.buildReferenceContext()
    )
    return systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages
  }

  /** 在同一个 assistant 聊天记录中循环请求模型并执行工具。 */
  private async runAgentLoop(
    params: ChatRequestParams,
    assistantMessageId: string,
    signal: AbortSignal,
    seq: number
  ): Promise<void> {
    this.status.value = 'streaming'

    while (seq === this.ctx.requestSeq && !signal.aborted) {
      const functions = this.getFunctions(params)
      const resolvedParams = await this.resolveModel(params)
      const result = await streamAgentStep({
        messages: this.messages,
        assistantMessageId,
        requestParams: resolvedParams,
        apiMessages: await this.buildRequestMessages(params, assistantMessageId),
        tools: this.buildTools(functions),
        config: this.ctx.config,
        signal,
        seq,
        currentSeq: () => this.ctx.requestSeq
      })
      if (result.cancelled) return
      if (result.toolCalls.length === 0) {
        this.status.value = result.finishReason === 'length' ? 'stop' : 'complete'
        this.ctx.config.onComplete?.(false, resolvedParams)
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
      this.ctx.config.onComplete?.(true)
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

  private async resolveAttachmentFiles(requestParams: ChatRequestParams): Promise<void> {
    if (!this.sandboxDir) return
    const contents = requestParams.message.content
    const inputsDir = window.preload.path.join(this.sandboxDir, 'inputs')
    for (const content of contents) {
      if (content.type !== 'attachment') continue
      for (const item of content.data) {
        if (!item.url) continue
        if (this.workspace && isPathUnder(item.url, this.workspace)) continue
        if (isPathUnder(item.url, inputsDir)) continue
        if (isPathUnder(item.url, this.sandboxDir)) {
          if (isPathUnder(item.url, window.preload.path.join(this.sandboxDir, 'tmp'))) {
            item.url = await copyToInputs(item.url, this.sandboxDir)
          }
          continue
        }
        item.url = await copyToInputs(item.url, this.sandboxDir)
      }
    }
  }

  async sendUserMessage(requestParams: ChatRequestParams): Promise<void> {
    if (!this.canStartRequest()) return
    if (requestParams.workspace) this.workspace = requestParams.workspace
    await this.resolveAttachmentFiles(requestParams)
    const { message } = requestParams
    const userMessage: UserMessage = {
      id: nanoid(),
      role: 'user',
      content: message.content,
      model: message.model,
      provide: message.provide,
      reasoning_effort: message.reasoning_effort
    }
    const assistantMessage = createPendingAssistantMessage()
    this.messages.value = [...this.messages.value, userMessage, assistantMessage]
    await this.executeRequest(requestParams, assistantMessage.id)
  }

  deleteFromUserMessage(messageId: string): void {
    if (!this.canStartRequest()) return
    const index = this.messages.value.findIndex((message) => message.id === messageId)
    if (index < 0) throw new Error('消息不存在')
    if (this.messages.value[index].role !== 'user') throw new Error('该消息不是用户消息')
    this.messages.value = this.messages.value.slice(0, index)
  }

  async abortChat(): Promise<void> {
    this.ctx.abortController?.abort()
    this.ctx.abortController = null
    this.status.value = 'stop'
    await this.ctx.config.onAbort?.()
  }

  setWorkspace(path: string): void {
    this.workspace = path
  }

  setSandboxDir(path: string): void {
    this.sandboxDir = path
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
