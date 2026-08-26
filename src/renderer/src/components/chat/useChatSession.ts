import type { ChatRequestParams, ChatType } from '@/modules/chat'
import { getChatSession, getSandboxDir, releaseChatSession } from '@/modules/chat'
import type { ChatMessage, ThinkingEffort, TokenBreakdown, UserMessage } from '@/domain'
import type { ChatSenderInitial } from '@/components/chat/sender/chatSenderInitial'
import { INTERACTIVE_KEY } from '@/modules/chat/agent/interactive'
import { readSubAgentContent, getRunningSubAgentMessages } from '@/modules/subagent'
import {
  collectSubAgents,
  lastAssistantIdOf,
  lastAssistantIndexOf
} from '@/modules/chat/agent/agentMessages'
import type { AgentTabItem } from '@/components/chat/SubAgentTabs.vue'
import { CANVAS_NODE_PICK_KEY, type CanvasNodeRef } from '@/components/chat/design/canvasNodeBridge'
import { PPT_NODE_PICK_KEY } from '@/components/chat/ppt/pptNodeBridge'
import type { PptNodeRef } from '@/components/chat/ppt/pptNodeBridge'
import { DEFAULT_CONTEXT_WINDOW } from '@/global/Constant'
import { useSettingAiStore } from '@/store'

export interface UseChatSessionOptions {
  chatId: string
  storageKey: string
  /** 外部指定沙盒目录，缺省时按 chatId 自动推导 */
  sandboxDir?: string
}

/**
 * 聊天会话绑定组合式函数（从 LChatEngine 提炼，供聊天组件复用）：
 * - 会话获取 / 水合 / 释放（ChatSessionManager 管理，跨挂载存活）
 * - 交互桥（INTERACTIVE_KEY）+ 画布节点桥（CANVAS_NODE_PICK_KEY）provide
 * - 发送 / 停止 / 清空 / 删除 / 续跑等会话操作
 * - 上次模型配置回填（initialState）、token 用量估算
 * - 子 Agent 切换（activeAgentId / tabs / 消息快照 / displayMessages 分流）
 *
 * 注意：storageKey 为固定值（会话切换由调用方用 :key 重建本组件实现）。
 */
export const useChatSession = (options: UseChatSessionOptions) => {
  const { chatId, storageKey, sandboxDir: sandboxDirProp } = options

  const inputValue = ref('')
  const modelValue = ref('')
  const thinking = ref(true)
  const effort = ref<ThinkingEffort>('high')

  const sandboxDir = computed(() => sandboxDirProp || getSandboxDir(chatId))

  // 会话由会话管理器持有，跨组件挂载存活：组件只负责绑定数据与转发事件
  const session = getChatSession(storageKey, {
    sandboxDir: sandboxDir.value,
    chatId
  })
  const instance = session.chat

  // 交互桥供 ask/confirm 卡片注入作答；本组件是 UI 消费方，使能后挂起决策才能被作答
  provide(INTERACTIVE_KEY, instance.interactive)
  instance.interactive.setEnabled(true)

  // 画布侧边栏双击节点 → 注入聊天输入框（CanvasRenderer inject，经本组件转发到 LChatSender.addCanvasNode）
  const senderRef = ref<{
    addCanvasNode: (ref: CanvasNodeRef) => void
    addPptNode: (ref: PptNodeRef) => void
  }>()
  provide(CANVAS_NODE_PICK_KEY, (ref) => senderRef.value?.addCanvasNode(ref))
  // PPT 侧边栏选中节点 → 注入聊天输入框（PptSlideViewer inject → LChatSender.addPptNode）
  provide(PPT_NODE_PICK_KEY, (ref) => senderRef.value?.addPptNode(ref))

  watch(sandboxDir, (val) => instance.setSandboxDir(val), { immediate: true })

  const { messages, status } = instance
  const workspace = session.workspace
  const mode = session.mode
  const agentId = session.agentId
  const chatType = session.type
  const writingScene = session.writingScene

  const handleSend = (message: ChatRequestParams) => {
    // 隐私标记为「创建后锁定」属性（chat 表行级列）：存量聊天不随消息修改，仅新建时经 AiChatStore.add 写入
    void session.send(message)
  }

  const handleStop = () => {
    session.stop()
  }

  const handleClear = () => {
    session.clear()
  }

  const handleDeleteMessage = (messageId: string) => {
    session.removeMessage(messageId)
  }

  const handleContinue = (assistantMessageId: string) => {
    session.continue(assistantMessageId)
  }

  const handleMessagesChange = () => {
    session.refreshMessages()
  }

  onMounted(() => {
    void session.load()
  })

  onBeforeUnmount(() => {
    // 注销挂载消费：空闲会话由会话管理器按 TTL 过期自动回收
    releaseChatSession(storageKey)
  })

  // 恢复上次使用的模型 / 思考配置：新会话草稿发送时 user 消息一加入即可回填，无需等待整个回答结束
  watch(
    messages,
    (val) => {
      const lastUser = val.findLast((e) => e.role === 'user') as UserMessage | undefined
      if (lastUser) {
        modelValue.value = `${lastUser.provide}:${lastUser.model}`
        thinking.value = lastUser.thinking ?? true
        effort.value = lastUser.reasoning_effort ?? 'high'
      }
    },
    { immediate: true }
  )

  // sender 初始化参数：组合会话状态与上次聊天恢复的模型 / 思考配置，任一字段变化都会重建对象引用，
  // sender 侧浅监听该引用即可整体应用（异步水合 / 恢复完成后外部不再变化）
  const initialState = computed<ChatSenderInitial>(() => ({
    input: inputValue.value,
    model: modelValue.value,
    thinking: thinking.value,
    effort: effort.value,
    agentId: agentId.value,
    mode: mode.value,
    privacy: session.privacy.value,
    type: chatType.value,
    writingScene: writingScene.value,
    designStyleId: session.designStyleId.value || undefined,
    workspace: workspace.value
  }))

  // 当前上下文 token 占用：取最后一条 assistant 消息的 usage.promptTokens 作为当前上下文大小，
  // tokenBreakdown 提供构成明细；窗口优先取模型配置，缺省用常量兜底。无 assistant 消息时返回 undefined。
  const tokenUsage = computed<
    | {
        contextTokens: number
        contextWindow: number
        breakdown: TokenBreakdown
      }
    | undefined
  >(() => {
    const lastAssistant = [...messages.value].reverse().find((m) => m.role === 'assistant')
    if (!lastAssistant || lastAssistant.role !== 'assistant' || !lastAssistant.usage)
      return undefined
    const modelKey = `${lastAssistant.provide}:${lastAssistant.model}`
    const contextWindow =
      useSettingAiStore().optionMap.get(modelKey)?.context || DEFAULT_CONTEXT_WINDOW
    return {
      contextTokens: lastAssistant.usage.promptTokens,
      contextWindow,
      breakdown: lastAssistant.tokenBreakdown ?? {
        system: 0,
        tools: 0,
        conversation: 0,
        skills: 0
      }
    }
  })

  // ─── 子 Agent 切换 ────────────────────────────────────────────────

  /** 当前选中的 Agent：'main' 表示主 Agent，否则为子 Agent ID */
  const activeAgentId = ref<string>('main')
  /** 子 Agent 消息快照（切换 tab 时从 sub_{subId}.json 加载） */
  const subAgentMessages = ref<ChatMessage[] | null>(null)

  /** 子 Agent 汇总（全部消息），tab 栏只取最后一条 AI 消息，侧边栏展示全部 */
  const allSubAgents = computed(() => collectSubAgents(messages.value))

  /**
   * 侧边栏面板类型：优先跟随活动子 Agent 的能力类型。
   * 切到 design 型子 Agent（如写作对话里的绘图子 Agent）时切为画布面板，便于查看其生成的图；
   * 其余（主 Agent / research 子 Agent）回落到会话类型。
   */
  const asideType = computed<ChatType>(() => {
    if (activeAgentId.value !== 'main') {
      const sub = allSubAgents.value.find((a) => a.subId === activeAgentId.value)
      if (sub?.type === 'design') return 'design'
    }
    return chatType.value
  })

  /**
   * 构建 Agent 切换卡片数据：仅展示最后一条 AI 消息 spawn 的子 Agent。
   * 历史子 Agent 对当前任务无意义，收敛到侧边栏「Agent 记录」查看。
   */
  const subAgentTabs = computed<AgentTabItem[]>(() => {
    const tabs: AgentTabItem[] = [{ id: 'main', label: '主 Agent' }]
    const lastIdx = lastAssistantIndexOf(messages.value)
    allSubAgents.value
      .filter((a) => a.messageIndex === lastIdx)
      .forEach((info, index) => {
        tabs.push({
          id: info.subId,
          label: `子 Agent ${index + 1}`,
          task: info.task,
          status: info.status
        })
      })
    return tabs
  })

  /** 侧边栏「Agent 记录」数据：全部子 Agent，最后一条消息的标记为当前轮 */
  const agentHistory = computed(() => {
    const lastIdx = lastAssistantIndexOf(messages.value)
    return allSubAgents.value.map((a) => ({ ...a, current: a.messageIndex === lastIdx }))
  })

  /** 当前展示的消息列表：主 Agent 显示会话消息；子 Agent 运行中实时绑定消息流，已完成显示磁盘快照 */
  const displayMessages = computed(() => {
    if (activeAgentId.value === 'main') return messages.value
    // 运行中的子 Agent：直接绑定其响应式 messages（streaming 实时刷新）
    const live = getRunningSubAgentMessages(activeAgentId.value)
    if (live) return live.value
    // 已完成：磁盘快照
    return subAgentMessages.value ?? []
  })

  // 切换 Agent tab：主 Agent 直接切回会话消息；子 Agent 运行中跳过磁盘加载（实时绑定），否则从磁盘加载快照
  watch(activeAgentId, async (agentId) => {
    if (agentId === 'main') {
      subAgentMessages.value = null
      return
    }
    // 运行中的子 Agent：displayMessages 实时绑定，无需磁盘快照
    if (getRunningSubAgentMessages(agentId)) {
      subAgentMessages.value = null
      return
    }
    try {
      const loaded = await readSubAgentContent(chatId, agentId)
      subAgentMessages.value = loaded ?? []
    } catch {
      subAgentMessages.value = []
    }
  })

  /** 当前选中的子 Agent 是否在运行中（依赖注册表，注册/注销时重算） */
  const activeSubRunning = computed(() => {
    if (activeAgentId.value === 'main') return false
    return !!getRunningSubAgentMessages(activeAgentId.value)
  })

  // 子 Agent 从运行中变为完成（从注册表移除）的瞬间：重载磁盘快照，避免 displayMessages 突变为空
  watch(activeSubRunning, async (running) => {
    if (running || activeAgentId.value === 'main') return
    try {
      const loaded = await readSubAgentContent(chatId, activeAgentId.value)
      subAgentMessages.value = loaded ?? []
    } catch {
      subAgentMessages.value = []
    }
  })

  const handleSwitchAgent = (agentId: string) => {
    activeAgentId.value = agentId
  }

  /** 点击 spawn_agent 工具卡片：切换到对应子 Agent */
  const handleViewSubAgent = (subAgentId: string) => {
    activeAgentId.value = subAgentId
  }

  // 新一轮回复开始时，若仍停留在历史子 Agent（已不在当前轮 tab 中），自动回到主 Agent
  watch(
    () => lastAssistantIdOf(messages.value),
    () => {
      if (activeAgentId.value === 'main') return
      const currentSubIds = new Set(
        subAgentTabs.value.map((t) => t.id).filter((id) => id !== 'main')
      )
      if (!currentSubIds.has(activeAgentId.value)) activeAgentId.value = 'main'
    }
  )

  return {
    session,
    instance,
    messages,
    status,
    workspace,
    mode,
    agentId,
    chatType,
    writingScene,
    sandboxDir,
    senderRef,
    inputValue,
    modelValue,
    thinking,
    effort,
    initialState,
    tokenUsage,
    handleSend,
    handleStop,
    handleClear,
    handleDeleteMessage,
    handleContinue,
    handleMessagesChange,
    activeAgentId,
    subAgentTabs,
    agentHistory,
    displayMessages,
    asideType,
    handleSwitchAgent,
    handleViewSubAgent
  }
}
