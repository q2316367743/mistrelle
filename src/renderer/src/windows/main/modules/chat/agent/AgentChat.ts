import type { AiMessageParam } from '@/windows/main/modules/ai'
import type { ChatMessage, TodoItem, ToolFunction, UserMessage } from '@/domain'
import { nanoid } from 'nanoid'
import { skillAgentList } from '@/windows/main/modules/skill'
import type { AiChatMode } from '@/entity'
import type { ChatType, ChatTypeToolContext } from '@/windows/main/modules/chat/chatType'
import type { DesignScene } from '@/windows/main/modules/chat/designScene'
import type { WritingScene } from '@/windows/main/modules/chat/writingScene'
import type { ToolPolicyContext } from '@/windows/main/modules/tool/toolPolicy'
import { useSettingAiStore } from '@/windows/main/store'
import type { SubAgentType } from '@/windows/main/modules/subagent/types'
import type {
  ChatContext,
  ChatMessageSetterMode,
  ChatRequestParams,
  ChatServiceConfig,
  ChatStatus,
  ResolvedChatRequestParams
} from '@/windows/main/modules/chat'
import { createPendingAssistantMessage } from './agentMessages'
import type { ToolCall } from './agentTypes'
import { InteractiveBridge } from './interactive'
import { copyToInputs } from '@/utils/chatSender'
import { isPathUnder } from '@/utils/sandbox'
import { executeAgentRequest } from './agentLoop'
import {
  continueAgentRun,
  resumePendingInteractives as resumeInteractives,
  sweepPendingToolCalls as sweepToolCalls
} from './agentResume'
import {
  buildAgentRequestMessages,
  type PromptContext,
  type WorkspaceSettingsCache
} from './agentPrompts'
import {
  getToolFunctions,
  resolveForExecution as resolveLoadedTools,
  type ToolSurfaceContext
} from './agentFunctions'

export interface UseChatOptions {
  defaultMessages?: ChatMessage[]
  chatServiceConfig?: ChatServiceConfig
  functions?: ToolFunction[]
  systemPrompt?: string
  enableSkill?: boolean
  sandboxDir?: string
  workspace?: string
  /** 聊天模式（0 默认 / 1 计划 / 2 完全访问），用于约束工具执行行为 */
  mode?: AiChatMode
  /** 隐私聊天（子 Agent 继承主 Agent 标记）：不注入记忆、不注册记忆工具 */
  privacy?: boolean
  /** 聊天 ID（用于子 Agent 文件路径构建，主 Agent 必传） */
  chatId?: string
  /** 是否为子 Agent：禁用 spawn_agent 工具（防止嵌套派发导致路径错乱），且不注入子 Agent 使用指导 */
  isSubAgent?: boolean
  /** 子 Agent 能力类型（「仅场景工具」型据此切换为封闭的专用工具集） */
  subAgentType?: SubAgentType
  /**
   * 显式封闭工具面：只注入传入的 functions，不并入默认常驻工具 / 用户勾选 / 装载器，
   * 并关闭渐进装载与执行期 toolRegistry 兜底（与「仅场景工具」型子 Agent 同款封闭分支）。
   * 供 design_draw 等「工具面由调用方完全决定」的内部 Agent 使用。
   */
  closedToolSurface?: boolean
  /** 单轮 agent loop 最大工具迭代步数，缺省用 MAX_AGENT_STEPS；子 Agent 传入更大预算以完成复杂调研 */
  maxSteps?: number
  /** 触顶步数后是否执行最后一次无工具调用强制输出最终总结（子 Agent 使用，避免触顶时只返回截断提示） */
  finalizeOnMaxSteps?: boolean
}

/**
 * 会话引擎门面：持有响应式状态与配置，循环编排（agentLoop）、恢复续跑（agentResume）、
 * 提示词（agentPrompts）、函数表（agentFunctions）经快照/实例协作。
 * 标注「协作面」的成员供 agent/ 内部模块访问，不属于对外 API。
 */
export class ToolChat {
  readonly messages = ref<ChatMessage[]>([])
  readonly status = ref<ChatStatus>('idle')
  readonly toolCalls = ref<ToolCall[]>([])
  readonly todos = ref<TodoItem[]>([])
  /** ask / confirm 交互桥：供 UI 卡片注入并作答 */
  readonly interactive = new InteractiveBridge()
  /** 本条消息内已装载的工具集合 id（渐进式加载临时态：每轮请求开始清空，不落库不持久化）【协作面】 */
  readonly loadedCollections = ref<string[]>([])
  /** 最近一轮是否因达到工具调用步数上限而结束（子 Agent 摘要提取据此区分是否正常收尾） */
  readonly hitMaxSteps = ref(false)
  /** 本轮是否触达过工具调用步数上限（finalizeOnMaxSteps 成功收尾时 hitMaxSteps 保持 false，但触顶事实需透出给调用方追加备注） */
  readonly reachedMaxSteps = ref(false)
  /** 请求上下文（seq 抢占 + abort 信号 + 回调配置）【协作面：agentLoop 读写】 */
  readonly ctx: ChatContext
  private readonly functions: ToolFunction[]
  private readonly systemPrompt: string
  private sandboxDir = ''
  /** 当前工作空间（resume 重建参数时读取）【协作面】 */
  workspace = ''
  /** 聊天级目录白名单（用户在确认卡片勾选「此目录以后都允许」累积），响应式供会话 watch 持久化 */
  readonly allowedDirs = ref<string[]>([])
  /** 当前聊天模式，0 默认 / 1 计划 / 2 完全访问【协作面：agentLoop 按模式决定步数上限】 */
  mode: AiChatMode = 0
  /** 隐私聊天：不注入记忆、不注册记忆工具（发送时设置，标记持久化在 chat 表 privacy 列） */
  private privacy = false
  /** 聊天类型（新建对话时选定，创建后锁定；缺省回退 office） */
  private chatType: ChatType = 'office'
  /** 聊天 ID（用于子 Agent 文件路径构建） */
  private chatId = ''
  /** 是否为子 Agent（禁用 spawn_agent 工具，防止嵌套派发）【协作面：agentLoop 触顶提示裁剪】 */
  readonly isSubAgent: boolean = false
  /** 子 Agent 能力类型（「仅场景工具」型据此切换为封闭的专用工具集） */
  private subAgentType?: SubAgentType
  /** 显式封闭工具面（design_draw 等内部 Agent）：只暴露注入的 functions，关闭装载器与注册表兜底【协作面】 */
  readonly closedToolSurface: boolean = false
  /** 写作子场景（writing 类型内部分层，新建对话时选定，创建后锁定；缺省 article） */
  private writingScene: WritingScene = 'article'
  /** 设计子场景（design 类型的渲染引擎 canvas / html，新建对话时选定，创建后锁定；缺省 canvas） */
  private designScene: DesignScene = 'canvas'
  /** 设计风格提示词（design 类型，创建后锁定；会话水合时由设计风格对象构建，缺省空串不注入） */
  private designStylePrompt = ''
  /** 工作空间设定文件内容缓存，键为 workspace 路径，避免 agent 循环中重复读盘 */
  private workspaceSettingsCache: WorkspaceSettingsCache | null = null
  /** 最近一次构建请求时的技能目录提示词（用于 token 构成估算，随消息持久化）【协作面：agentLoop 估算读取】 */
  lastSkillCatalogPrompt = ''
  /** 单轮 agent loop 最大工具迭代步数，缺省用 MAX_AGENT_STEPS【协作面】 */
  readonly maxSteps?: number
  /** 触顶步数后是否执行最后一次无工具收尾调用，强制模型立即输出总结（子 Agent 使用）【协作面】 */
  readonly finalizeOnMaxSteps: boolean = false
  /** 锚点修改模式的锚点节点 id 集合（空 = 非锚点模式，AI 可自由修改） */
  private anchorNodeIds: string[] = []

  constructor(options: UseChatOptions = {}) {
    this.messages.value = [...(options.defaultMessages ?? [])]
    this.ctx = {
      config: { ...(options.chatServiceConfig ?? {}) },
      abortController: null,
      requestSeq: 0
    }
    this.functions = options.functions ?? []
    this.systemPrompt = options.systemPrompt ?? ''
    this.mode = options.mode ?? 0
    this.privacy = options.privacy ?? false
    if (options.sandboxDir) this.sandboxDir = options.sandboxDir
    if (options.workspace) this.workspace = options.workspace
    if (options.chatId) this.chatId = options.chatId
    if (options.isSubAgent) this.isSubAgent = true
    this.subAgentType = options.subAgentType
    if (options.closedToolSurface) this.closedToolSurface = true
    if (options.maxSteps) this.maxSteps = options.maxSteps
    if (options.finalizeOnMaxSteps) this.finalizeOnMaxSteps = true
  }

  /** 解析模型配置（provider:key → 请求参数）【协作面：agentLoop 每步调用】 */
  async resolveModel(params: ChatRequestParams): Promise<ResolvedChatRequestParams> {
    const store = useSettingAiStore()
    if (!store.ready) await store.initPromise
    const option = store.optionMap.get(`${params.message.provide}:${params.message.model}`)
    if (!option) throw new Error('模型不存在或未启用，请在 AI 设置中配置。')
    return {
      ...params,
      baseURL: option.baseUrl,
      apiKey: option.key,
      format: option.format ?? 'chat',
      support: option.support,
      builtin: option.builtin,
      sessionId: this.chatId || undefined
    }
  }

  /** 场景工具注入上下文（统一构造，避免各工具 ctx 遗漏字段） */
  private typeToolsContext(): ChatTypeToolContext {
    return {
      getSandboxDir: () => this.sandboxDir,
      getWorkspace: () => this.workspace,
      writingScene: this.writingScene,
      designScene: this.designScene,
      getAnchorNodeIds: () => this.anchorNodeIds
    }
  }

  /** 函数表构建上下文快照（agentFunctions 用，每次构建新取以反映最新会话配置） */
  private toolSurface(): ToolSurfaceContext {
    return {
      functions: this.functions,
      isSubAgent: this.isSubAgent,
      privacy: this.privacy,
      mode: this.mode,
      chatType: this.chatType,
      subAgentType: this.subAgentType,
      closedToolSurface: this.closedToolSurface,
      typeTools: this.typeToolsContext(),
      todos: this.todos,
      loadedCollections: this.loadedCollections
    }
  }

  /** 提示词构建上下文快照（agentPrompts 用） */
  private promptContext(): PromptContext {
    return {
      messages: this.messages,
      systemPrompt: this.systemPrompt,
      isSubAgent: this.isSubAgent,
      subAgentType: this.subAgentType,
      closedToolSurface: this.closedToolSurface,
      privacy: this.privacy,
      mode: this.mode,
      chatType: this.chatType,
      writingScene: this.writingScene,
      designStylePrompt: this.designStylePrompt,
      anchorNodeIds: this.anchorNodeIds,
      sandboxDir: this.sandboxDir,
      workspace: this.workspace,
      typeTools: this.typeToolsContext(),
      todos: this.todos
    }
  }

  /** 请求侧函数表（第①层基础 + 第②层已装载集合）【协作面：agentLoop / agentResume】 */
  getFunctions(params: ChatRequestParams): ToolFunction[] {
    return getToolFunctions(this.toolSurface(), params)
  }

  /** 执行前洋葱解析（含跨 Loop 自动恢复）【协作面：agentLoop / agentResume】 */
  resolveForExecution(names: string[], base: ToolFunction[]): ToolFunction[] {
    return resolveLoadedTools(this.toolSurface(), names, base)
  }

  /** 组装单次请求的完整 API 消息【协作面：agentLoop】 */
  async buildRequestMessages(
    params: ResolvedChatRequestParams,
    assistantMessageId: string
  ): Promise<AiMessageParam[]> {
    const built = await buildAgentRequestMessages(
      this.promptContext(),
      params,
      assistantMessageId,
      this.workspaceSettingsCache
    )
    this.lastSkillCatalogPrompt = built.skillCatalogPrompt
    this.workspaceSettingsCache = built.settingsCache
    return built.apiMessages
  }

  canStartRequest(): boolean {
    return ['idle', 'complete', 'error', 'stop'].includes(this.status.value)
  }

  /** 收口收割（agentResume 提供）：水合 / 循环收束 / 异常路径统一定格非终态工具块 */
  sweepPendingToolCalls(assistantMessageId?: string): void {
    sweepToolCalls(this, assistantMessageId)
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
      thinking: message.thinking,
      reasoning_effort: message.reasoning_effort
    }
    const assistantMessage = createPendingAssistantMessage({
      model: message.model,
      provide: message.provide,
      agentId: requestParams.agentId,
      mode: this.mode,
      thinking: message.thinking,
      reasoningEffort: message.reasoning_effort
    })
    this.messages.value = [...this.messages.value, userMessage, assistantMessage]
    await executeAgentRequest(this, requestParams, assistantMessage.id)
  }

  /**
   * 应用重启后恢复上次挂起的 ask / confirm 决策（agentResume 提供）：
   * 重新挂起等用户作答，作答后复用同一条 assistant 消息续跑同一轮。
   */
  async resumePendingInteractives(): Promise<void> {
    await resumeInteractives(this)
  }

  /** 连续工具调用达到上限后继续推进同一轮（agentResume 提供） */
  async continueAgent(assistantMessageId: string): Promise<void> {
    await continueAgentRun(this, assistantMessageId)
  }

  deleteFromUserMessage(messageId: string): void {
    if (!this.canStartRequest()) return
    const index = this.messages.value.findIndex((message) => message.id === messageId)
    if (index < 0) throw new Error('消息不存在')
    if (this.messages.value[index].role !== 'user') throw new Error('该消息不是用户消息')
    this.messages.value = this.messages.value.slice(0, index)
    // 历史被截断，待办清单随之失效，避免与残留进度不一致
    this.todos.value = []
  }

  async abortChat(): Promise<void> {
    this.ctx.abortController?.abort()
    this.ctx.abortController = null
    // 解除挂起的 ask/confirm 决策，让挂起的工具调用以「未回答」结束，避免卡死
    this.interactive.clear()
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

  /** 设置聊天级目录白名单（会话水合时恢复持久化数据） */
  setAllowedDirs(dirs: string[]): void {
    this.allowedDirs.value = [...dirs]
  }

  /** 用户勾选「此目录以后都允许」时追加目录（归一化去重） */
  allowDir(dir: string): void {
    const normalized = window.preload.path.normalizePath(dir)
    if (!normalized) return
    const exists = this.allowedDirs.value.some(
      (item) => window.preload.path.normalizePath(item) === normalized
    )
    if (!exists) this.allowedDirs.value = [...this.allowedDirs.value, dir]
  }

  /** 组装工具策略上下文（主循环与 resume 共用）：主 Agent 携带聊天白名单及其回写，子 Agent 保持只读不带 */
  buildPolicyContext(signal?: AbortSignal): ToolPolicyContext {
    const ctx: ToolPolicyContext = {
      chatId: this.chatId,
      sandboxDir: this.sandboxDir,
      workspace: this.workspace,
      mode: this.mode,
      privacy: this.privacy,
      isSubAgent: this.isSubAgent,
      chatType: this.chatType,
      abortSignal: signal,
      // skill 根目录内脚本执行免审批；toolPolicy 保持叶子 import，故由调用方注入（见 docs/tool/07）
      skillRootDirs: skillAgentList().map((agent) => agent.path)
    }
    if (!this.isSubAgent) {
      ctx.allowedDirs = [...this.allowedDirs.value]
      ctx.onAllowDir = (dir: string) => this.allowDir(dir)
    } else {
      // 子 Agent 无交互桥：需审批的调用直接自动拒绝（不进 awaitDecision 等待）
      ctx.denyOnAsk = true
    }
    return ctx
  }

  setChatId(id: string): void {
    this.chatId = id
  }

  /** 设置锚点修改模式的锚点节点 id（选中元素）；空数组 = 解除锚点模式 */
  setAnchorNodeIds(ids: string[]): void {
    this.anchorNodeIds = [...ids]
  }

  /** 获取当前锚点节点 id 集合 */
  getAnchorNodeIds(): string[] {
    return [...this.anchorNodeIds]
  }

  setMode(mode: AiChatMode): void {
    this.mode = mode
  }

  /** 设置隐私聊天标记（会话水合 / 子 Agent 继承时注入；创建后锁定，不随消息修改） */
  setPrivacy(privacy: boolean): void {
    this.privacy = privacy
  }

  /** 设置聊天类型（新建对话时选定，创建后锁定） */
  setType(type: ChatType): void {
    this.chatType = type
  }

  /** 获取当前聊天类型 */
  getType(): ChatType {
    return this.chatType
  }

  /** 设置写作子场景（新建对话时选定，创建后锁定；仅 writing 类型生效） */
  setWritingScene(scene: WritingScene): void {
    this.writingScene = scene
  }

  /** 获取当前写作子场景 */
  getWritingScene(): WritingScene {
    return this.writingScene
  }

  /** 设置设计子场景即渲染引擎（新建对话时选定，创建后锁定；仅 design 类型生效） */
  setDesignScene(scene: DesignScene): void {
    this.designScene = scene
  }

  /** 设置设计风格提示词（design 类型创建后锁定，会话水合时注入） */
  setDesignStylePrompt(prompt: string): void {
    this.designStylePrompt = prompt
  }

  init(initialMessages?: ChatMessage[]): void {
    if (initialMessages) this.messages.value = [...initialMessages]
    // 水合即清洗：治愈存量残缺状态（结果在而未标完成），保留等待审批的挂起块供 resume
    this.sweepPendingToolCalls()
  }

  setMessages(messages: ChatMessage[], mode: ChatMessageSetterMode = 'replace'): void {
    if (mode === 'replace') this.messages.value = [...messages]
    else if (mode === 'prepend') this.messages.value = [...messages, ...this.messages.value]
    else this.messages.value = [...this.messages.value, ...messages]
    this.sweepPendingToolCalls()
  }

  setTodos(todos: TodoItem[]): void {
    this.todos.value = [...todos]
  }

  clearMessages(): void {
    this.messages.value = []
    this.todos.value = []
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
    this.todos.value = []
    this.loadedCollections.value = []
    this.interactive.clear()
  }
}
