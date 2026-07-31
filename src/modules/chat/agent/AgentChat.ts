import type {
  ChatCompletionMessageParam,
  ChatCompletionTool
} from 'openai/resources/chat/completions'
import type {
  AttachmentContent,
  ChatMessage,
  ToolContent,
  ToolFunction,
  UserMessage
} from '@/domain'
import { nanoid } from 'nanoid'
import { buildSkillCatalogPrompt, localSkillList } from '@/modules/skill'
import { buildAiAgentPrompt } from '@/entity/ai'
import type { AiChatMode } from '@/entity'
import { defaultTools, getMcpTools, isShellExecTool, toolMap } from '@/modules/tool'
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
  /** 聊天模式（0 默认 / 1 计划 / 2 完全访问），用于约束工具执行行为 */
  mode?: AiChatMode
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
  /** 当前聊天模式，0 默认 / 1 计划 / 2 完全访问 */
  private mode: AiChatMode = 0
  /** 工作空间设定文件内容缓存，键为 workspace 路径，避免 agent 循环中重复读盘 */
  private workspaceSettingsCache: { path: string; content: string } | null = null

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
    this.mode = options.mode ?? 0
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
    const agent = params.agentId ? useAiAgentStore().getById(params.agentId) : undefined
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

  /**
   * 按当前聊天模式过滤暴露给模型的工具，作为模型层兜底：
   * - 1 计划模式：仅暴露只读 / 分析类（safe）与执行类（shell）工具，写入 / 修改类物理隐藏
   * - 0 默认 / 2 完全访问：原样返回
   */
  private filterToolsByMode(functions: ToolFunction[]): ToolFunction[] {
    if (this.mode === 1) {
      return functions.filter((fn) => fn.risk === 'safe' || isShellExecTool(fn))
    }
    return functions
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

  /**
   * 读取工作空间下的设定文件（AGENTS.md / CLAUDE.md）并组装为提示词段落。
   * 设定文件包含项目约束与开发约定，需在系统提示词中告知模型遵循；
   * 使用缓存避免 agent 循环中重复读取磁盘。
   */
  private async buildWorkspaceSettingsPrompt(): Promise<string> {
    if (!this.workspace) return ''
    if (this.workspaceSettingsCache && this.workspaceSettingsCache.path === this.workspace) {
      return this.workspaceSettingsCache.content
    }
    const settingFiles = ['AGENTS.md', 'CLAUDE.md']
    const sections: string[] = []
    for (const fileName of settingFiles) {
      const filePath = window.preload.path.join(this.workspace, fileName)
      if (!window.preload.fs.existsSync(filePath)) continue
      try {
        const content = await window.preload.fs.readTextFile(filePath)
        if (content.trim()) sections.push(`### ${fileName}\n\n${content.trim()}`)
      } catch {
        // 读取失败（权限/编码）不阻断对话，跳过该设定文件
        continue
      }
    }
    const content = sections.length
      ? `## 工作空间设定文件\n\n以下是工作空间（${this.workspace}）下的设定文件内容，请严格遵循其中的约束与开发约定：\n\n${sections.join('\n\n')}`
      : ''
    this.workspaceSettingsCache = { path: this.workspace, content }
    return content
  }

  private buildReferenceContext(): string {
    const lastUserMessage = [...this.messages.value].reverse().find((m) => m.role === 'user')
    if (!lastUserMessage || lastUserMessage.role !== 'user') return ''
    const contents = lastUserMessage.content
    const attachments = contents
      .filter((content): content is AttachmentContent => content.type === 'attachment')
      .flatMap((content) => content.data)
    if (attachments.length === 0) return ''
    const parts = attachments.map(
      (item) => `## File: ${item.name ?? item.url}\n路径：${item.url}\n`
    )
    return `\n\n---\n以下是用户在输入框中引用的上下文，请结合这些内容回答：\n\n${parts.join('\n---\n')}`
  }

  private async buildRequestMessages(
    params: ChatRequestParams,
    assistantMessageId: string
  ): Promise<ChatCompletionMessageParam[]> {
    const agent = params.agentId ? useAiAgentStore().getById(params.agentId) : undefined
    const agentPrompt = agent ? buildAiAgentPrompt(agent) : ''
    const skills = await localSkillList()
    const catalogPrompt = buildSkillCatalogPrompt(skills)
    const workspacePrompt = this.buildWorkspacePrompt()
    const workspaceSettingsPrompt = await this.buildWorkspaceSettingsPrompt()
    // system 前缀保持稳定的可缓存内容；skill 正文由 load_skill 工具按需在对话中加载，不进 system
    const systemPrompt = [
      this.systemPrompt,
      agentPrompt,
      catalogPrompt,
      workspacePrompt,
      workspaceSettingsPrompt
    ]
      .filter(Boolean)
      .join('\n\n')
    const systemMessages: ChatCompletionMessageParam[] = []
    if (systemPrompt) systemMessages.push({ role: 'system', content: systemPrompt })
    // 模式指令作为独立 system 消息追加（不污染稳定 system 提示词，保留缓存前缀）
    const modeInstruction = this.buildModeInstruction()
    if (modeInstruction) systemMessages.push({ role: 'system', content: modeInstruction })
    const messages = toAgentRequestMessages(
      this.messages.value,
      assistantMessageId,
      this.buildReferenceContext()
    )
    return [...systemMessages, ...messages]
  }

  /**
   * 根据当前聊天模式生成一段"模式指令"，作为独立 system 消息追加到稳定 system 之后。
   * 不写入稳定 system 提示词，以保留其缓存前缀；参考 opencode 做法，让 AI 自行收敛行为：
   * - 1 计划模式：可读取 / 分析、可运行 shell（需审批），但严禁写入 / 修改文件，建议先给计划
   * - 0 默认 / 2 完全访问：无附加指令
   */
  private buildModeInstruction(): string {
    if (this.mode === 1) {
      return '【计划模式】当前处于计划模式。你可以读取、分析文件，也可以运行 shell 命令（运行前会请求用户批准）。但你没有任何写入 / 修改文件的权限，禁止创建、编辑或删除任何文件。建议先给出清晰的执行计划，涉及写文件的操作请明确说明并交由用户在默认模式下执行。'
    }
    return ''
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
      const functions = this.filterToolsByMode(this.getFunctions(params))
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
        { sandboxDir: this.sandboxDir, workspace: this.workspace, mode: this.mode },
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
    this.mode = requestParams.mode ?? this.mode
    if (requestParams.workspace && requestParams.workspace !== this.workspace) {
      this.workspace = requestParams.workspace
      this.workspaceSettingsCache = null
    }
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
    const assistantMessage = createPendingAssistantMessage({
      model: message.model,
      provide: message.provide,
      agentId: requestParams.agentId,
      mode: this.mode
    })
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
    if (path === this.workspace) return
    this.workspace = path
    this.workspaceSettingsCache = null
  }

  setSandboxDir(path: string): void {
    this.sandboxDir = path
  }

  setMode(mode: AiChatMode): void {
    this.mode = mode
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
