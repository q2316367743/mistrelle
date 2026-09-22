import type { ChatRequestParams, ChatType } from '@/windows/main/modules/chat'
import { getChatSession, getSandboxDir, releaseChatSession } from '@/windows/main/modules/chat'
import type { ChatMessage, ThinkingEffort, TokenBreakdown, UserMessage } from '@/domain'
import type { AiChatMode } from '@/entity'
import type { ChatSenderInitial } from '@/windows/main/components/sender/chatSenderInitial'
import { INTERACTIVE_KEY } from '@/windows/main/modules/chat/agent/interactive'
import { readSubAgentContent, getRunningSubAgentMessages } from '@/windows/main/modules/subagent'
import {
  collectSubAgents,
  lastAssistantIndexOf,
  type SubAgentInfo
} from '@/windows/main/modules/chat/agent/agentMessages'
import { CANVAS_NODE_PICK_KEY, type CanvasNodeRef } from '@/windows/main/components/design/canvasNodeBridge'
import { HTML_ELEMENT_PICK_KEY, type HtmlElementRef } from '@/windows/main/components/design/htmlElementBridge'
import { DEFAULT_CONTEXT_WINDOW } from '@/global/Constant'
import { useSettingAiStore } from '@/windows/main/store'

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
 * - 子 Agent 查看（activeAgentId / 消息快照 / 侧栏面板数据）
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

  // 临时探针（定位卡头状态不更新），确认后移除：记录页面绑定的树快照规模
  console.log(
    `[ToolStat][绑定] ${storageKey} messages=${instance.messages.value.length}`
  )

  // 交互桥供 ask/confirm 卡片注入作答；本组件是 UI 消费方，使能后挂起决策才能被作答
  provide(INTERACTIVE_KEY, instance.interactive)
  instance.interactive.setEnabled(true)

  // 画布侧边栏双击节点 → 注入聊天输入框（CanvasRenderer inject，经本组件转发到 LChatSender.addCanvasNode）
  const senderRef = ref<{
    addCanvasNode: (ref: CanvasNodeRef) => void
    addHtmlElementNode: (ref: HtmlElementRef) => void
  }>()
  provide(CANVAS_NODE_PICK_KEY, (ref) => senderRef.value?.addCanvasNode(ref))
  // HTML 设计稿预览双击元素 → 注入聊天输入框（HtmlDesignAside inject，经本组件转发到 LChatSender.addHtmlElementNode）
  provide(HTML_ELEMENT_PICK_KEY, (ref) => senderRef.value?.addHtmlElementNode(ref))

  watch(sandboxDir, (val) => instance.setSandboxDir(val), { immediate: true })

  const { messages, status } = instance
  const workspace = session.workspace
  const mode = session.mode
  const agentId = session.agentId
  const chatType = session.type
  const writingScene = session.writingScene
  const designScene = session.designScene

  const handleSend = (message: ChatRequestParams) => {
    // 隐私标记为「创建后锁定」属性（chat 表行级列）：存量聊天不随消息修改，仅新建时经 AiChatStore.add 写入
    void session.send(message)
  }

  /**
   * 切换聊天模式：实时写入当前会话（同步引擎裁决 + 立即落盘），并作用于下一个工具调用。
   * sender 侧经 `v-model:mode` 绑定该会话状态，切换对话即自动显示对应对话的模式。
   */
  const handleModeChange = (value: AiChatMode) => {
    session.setMode(value)
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
    privacy: session.privacy.value,
    type: chatType.value,
    writingScene: writingScene.value,
    designScene: designScene.value,
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

  // ─── 子 Agent 查看 ────────────────────────────────────────────────

  /** 当前在侧栏查看的子 Agent ID：'main' 表示未打开（显示正常侧栏），否则为子 Agent ID */
  const activeAgentId = ref<string>('main')
  /** 子 Agent 消息快照（打开时从 chat_sub 表加载） */
  const subAgentMessages = ref<ChatMessage[] | null>(null)

  /** 子 Agent 汇总（全部消息），侧边栏「Agent 记录」展示全部 */
  const allSubAgents = computed(() => collectSubAgents(messages.value))

  /** 侧栏面板类型：恒为会话类型（子 Agent 记录走独立面板，不再借设计画布面板） */
  const asideType = computed<ChatType>(() => chatType.value)

  /** 侧边栏「Agent 记录」数据：全部子 Agent，最后一条消息的标记为当前轮 */
  const agentHistory = computed(() => {
    const lastIdx = lastAssistantIndexOf(messages.value)
    return allSubAgents.value.map((a) => ({ ...a, current: a.messageIndex === lastIdx }))
  })

  /** 当前在侧栏查看的子 Agent 汇总信息（含任务摘要 / 状态），'main' 时为 undefined */
  const activeSubAgent = computed<SubAgentInfo | undefined>(() => {
    if (activeAgentId.value === 'main') return undefined
    return allSubAgents.value.find((a) => a.subId === activeAgentId.value)
  })

  /** 侧栏展示的子 Agent 消息：运行中实时绑定消息流，已完成显示磁盘快照 */
  const activeSubAgentMessages = computed<ChatMessage[]>(() => {
    if (activeAgentId.value === 'main') return []
    // 运行中的子 Agent：直接绑定其响应式 messages（streaming 实时刷新）
    const live = getRunningSubAgentMessages(activeAgentId.value)
    if (live) return live.value
    // 已完成：磁盘快照
    return subAgentMessages.value ?? []
  })

  // 打开子 Agent：运行中跳过磁盘加载（实时绑定），否则从磁盘加载快照；关闭（main）时清空
  watch(activeAgentId, async (agentId) => {
    if (agentId === 'main') {
      subAgentMessages.value = null
      return
    }
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

  /** 当前查看的子 Agent 是否在运行中（依赖注册表，注册/注销时重算） */
  const activeSubRunning = computed(() => {
    if (activeAgentId.value === 'main') return false
    return !!getRunningSubAgentMessages(activeAgentId.value)
  })

  // 子 Agent 从运行中变为完成（从注册表移除）的瞬间：重载磁盘快照，避免消息区突变为空
  watch(activeSubRunning, async (running) => {
    if (running || activeAgentId.value === 'main') return
    try {
      const loaded = await readSubAgentContent(chatId, activeAgentId.value)
      subAgentMessages.value = loaded ?? []
    } catch {
      subAgentMessages.value = []
    }
  })

  /** 点击 spawn_agent 工具卡片 / 侧栏「Agent 记录」条目：在侧栏打开对应子 Agent */
  const handleViewSubAgent = (subAgentId: string) => {
    activeAgentId.value = subAgentId
  }

  /** 关闭子 Agent 面板：回到正常侧栏 */
  const handleCloseSubAgent = () => {
    activeAgentId.value = 'main'
  }

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
    designScene,
    sandboxDir,
    senderRef,
    inputValue,
    modelValue,
    thinking,
    effort,
    initialState,
    tokenUsage,
    handleSend,
    handleModeChange,
    handleStop,
    handleClear,
    handleDeleteMessage,
    handleContinue,
    handleMessagesChange,
    activeAgentId,
    activeSubAgent,
    activeSubAgentMessages,
    agentHistory,
    asideType,
    handleViewSubAgent,
    handleCloseSubAgent
  }
}
