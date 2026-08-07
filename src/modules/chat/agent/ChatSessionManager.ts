import { ref, toRaw, watch } from 'vue'
import { throttledWatch } from '@vueuse/core'
import type { ChatRequestParams, ChatStatus, ChatType, WritingScene } from '@/modules/chat'
import type { AiChatMode } from '@/entity/ai'
import { aiChatContentGet, aiChatContentSet } from '@/modules/chat/service/ChatService'
import { ToolChat } from './AgentChat'

/** 空闲会话自动回收 TTL：组件已关闭且非运行中的会话在超时后销毁并释放内存 */
const IDLE_RECLAIM_TTL = 5 * 60 * 1000

export interface ChatSessionOptions {
  storageKey: string
  sandboxDir?: string
  /** 聊天 ID（用于子 Agent 文件路径构建） */
  chatId?: string
}

/**
 * 会话对象：持有 ToolChat 引擎实例与跨挂载存活的状态（工作区 / 模式 / agent），
 * 并负责持久化。生命周期由会话管理器管理，独立于展示组件——组件卸载时
 * 会话仍存活，正在进行的作答不中断，切回时直接复用。
 */
export class ChatSession {
  readonly storageKey: string
  readonly chat: ToolChat
  /** 跨挂载存活：当前工作空间 */
  readonly workspace = ref('')
  /** 跨挂载存活：聊天模式（0 默认 / 1 计划 / 2 完全访问） */
  readonly mode = ref<AiChatMode>(0)
  /** 跨挂载存活：聊天类型（新建对话时选定，创建后锁定） */
  readonly type = ref<ChatType>('office')
  /** 跨挂载存活：写作子场景（writing 类型内部分层，创建后锁定；缺省 article） */
  readonly writingScene = ref<WritingScene>('article')
  /** 跨挂载存活：当前选中的 agent */
  readonly agentId = ref('')

  private hydrated = false
  private destroyed = false
  private unWatch?: () => void
  private unWatchStatus?: () => void
  /** 当前挂载消费本会话的组件数（>0 时豁免回收） */
  private activeCount = 0
  /** 空闲回收定时器 */
  private idleTimer?: ReturnType<typeof setTimeout>

  constructor(options: ChatSessionOptions, private readonly onIdleExpire: () => void) {
    this.storageKey = options.storageKey
    this.chat = new ToolChat({ sandboxDir: options.sandboxDir, chatId: options.chatId })
  }

  get messages() {
    return this.chat.messages
  }

  get status() {
    return this.chat.status
  }

  /** 会话是否处于作答中（运行态，回收豁免） */
  get isRunning(): boolean {
    const s = this.chat.status.value
    return s === 'pending' || s === 'streaming'
  }

  /** 组件挂载消费本会话：登记活跃并取消待回收定时器 */
  touch(): void {
    this.activeCount += 1
    this.cancelIdleReclaim()
  }

  /** 组件卸载释放本会话：无活跃消费且未运行则安排过期回收 */
  release(): void {
    this.activeCount = Math.max(0, this.activeCount - 1)
    if (this.activeCount === 0 && !this.isRunning) this.scheduleIdleReclaim()
  }

  private scheduleIdleReclaim(): void {
    this.cancelIdleReclaim()
    this.idleTimer = setTimeout(() => {
      this.idleTimer = undefined
      // 二次校验，避免释放瞬间会话又被复用或转入运行态
      if (this.activeCount === 0 && !this.isRunning) this.onIdleExpire()
    }, IDLE_RECLAIM_TTL)
  }

  private cancelIdleReclaim(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = undefined
    }
  }

  /**
   * 首次挂载时水合：从磁盘恢复消息 / 待办 / 工作区 / 模式 / agent，并建立常驻持久化
   * watcher（会话存活期间持续落盘，后台作答不丢进度）。存活会话直接返回，不重复水合，
   * 避免用磁盘旧文件覆盖后台流式的最新消息。
   */
  async load(): Promise<void> {
    if (this.hydrated) return
    this.hydrated = true
    const content = await aiChatContentGet(this.storageKey)
    // 水合期间会话被销毁（删除聊天），直接放弃，避免重建常驻 watcher 与草稿发送
    if (this.destroyed) return
    if (content) {
      this.chat.init(content.messages)
      if (content.todos) this.chat.setTodos(content.todos)
      if (content.workspace) {
        this.workspace.value = content.workspace
        this.chat.setWorkspace(content.workspace)
      }
      this.mode.value = content.mode
      this.chat.setMode(content.mode)
      if (content.agentId) this.agentId.value = content.agentId
      // 旧数据无 type 字段时回退 office
      this.type.value = content.type ?? 'office'
      this.chat.setType(this.type.value)
      // 旧数据无 writingScene 字段时回退 article（历史 free 数据一并并入文章创作）
      this.writingScene.value = content.writingScene ?? 'article'
      this.chat.setWritingScene(this.writingScene.value)
    }
    // 常驻持久化：watcher 在水合之后建立，避免 immediate 用空消息覆盖含 draft 的存储文件
    this.unWatch = throttledWatch(this.chat.messages, () => this.persist(), {
      throttle: 1000,
      deep: true
    })
    // 状态 watcher：运行中（pending/streaming）豁免回收；结束且无挂载消费时重新安排过期回收
    this.unWatchStatus = watch(this.chat.status, () => {
      if (this.isRunning) {
        this.cancelIdleReclaim()
      } else if (this.activeCount === 0) {
        this.scheduleIdleReclaim()
      }
    })
    // 新会话首轮发送草稿；否则恢复上次挂起的 ask/confirm 决策（sendUserMessage 后 status
    // 为 pending/streaming，resumePendingInteractives 内部会因 canStartRequest 直接返回）
    const hasUserMessage = this.chat.messages.value.some((m) => m.role === 'user')
    if (!hasUserMessage && content?.draft) {
      await this.chat.sendUserMessage(content.draft)
    }
    await this.chat.resumePendingInteractives()
  }

  async send(params: ChatRequestParams): Promise<void> {
    if (params.workspace) this.workspace.value = params.workspace
    this.mode.value = params.mode
    if (params.agentId) this.agentId.value = params.agentId
    // 注意：聊天类型（type）与写作子场景（writingScene）为「创建后锁定」属性，
    // 由 load() 从持久化的 AiChatContent 恢复，此处不得随消息修改。
    await this.chat.sendUserMessage(params)
  }

  stop(): void {
    void this.chat.abortChat()
  }

  clear(): void {
    this.chat.clearMessages()
  }

  removeMessage(messageId: string): void {
    this.chat.deleteFromUserMessage(messageId)
  }

  continue(assistantMessageId: string): void {
    void this.chat.continueAgent(assistantMessageId)
  }

  refreshMessages(): void {
    this.chat.messages.value = [...this.chat.messages.value]
  }

  /** 销毁会话：停止持久化并销毁引擎实例（删除聊天 / 任务 / 项目或空闲过期回收时调用） */
  destroy(): void {
    this.destroyed = true
    this.cancelIdleReclaim()
    this.unWatch?.()
    this.unWatchStatus?.()
    this.chat.destroy()
  }

  private persist(): void {
    void aiChatContentSet(this.storageKey, {
      updatedTime: Date.now(),
      draft: undefined,
      agentId: this.agentId.value,
      workspace: this.workspace.value || '',
      messages: toRaw(this.chat.messages.value),
      mode: this.mode.value,
      type: this.type.value,
      writingScene: this.writingScene.value,
      todos: toRaw(this.chat.todos.value)
    })
  }
}

const sessions = new Map<string, ChatSession>()

/**
 * 会话管理器：获取指定存储键对应的会话。存在即复用（跨组件挂载存活），
 * 不存在则新建并登记。键使用 storageKey（唯一 JSON 路径），避免独立聊天与
 * 项目任务 id 撞车。每次获取都会 touch 会话，标记其处于挂载消费中。
 */
export const getChatSession = (
  storageKey: string,
  options: Omit<ChatSessionOptions, 'storageKey'> = {}
): ChatSession => {
  let session = sessions.get(storageKey)
  if (!session) {
    const created = new ChatSession({ storageKey, ...options }, () => {
      created.destroy()
      sessions.delete(storageKey)
    })
    session = created
    sessions.set(storageKey, session)
  }
  session.touch()
  return session
}

/** 组件卸载时释放会话：仅注销挂载消费，不做销毁；空闲会话由过期回收统一处理 */
export const releaseChatSession = (storageKey: string): void => {
  sessions.get(storageKey)?.release()
}

/** 查询会话当前状态；无会话返回 undefined（供列表组件展示加载图标） */
export const getChatSessionStatus = (storageKey: string): ChatStatus | undefined =>
  sessions.get(storageKey)?.chat.status.value

/** 删除单个聊天时销毁对应会话 */
export const destroyChatSession = (storageKey: string): void => {
  sessions.get(storageKey)?.destroy()
  sessions.delete(storageKey)
}

/** 删除项目时批量销毁该项目下的会话（键以项目目录为前缀） */
export const destroyChatSessionsByPrefix = (prefix: string): void => {
  for (const key of [...sessions.keys()]) {
    if (key.startsWith(prefix)) destroyChatSession(key)
  }
}
