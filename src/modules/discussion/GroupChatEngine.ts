import { watch } from 'vue'
import type { AIMessage } from '@/domain'
import type {
  AiDiscussion,
  AiDiscussionRole,
  AiGroupChat,
  AiGroupChatMessage
} from '@/entity/ai'
import { useSnowflake } from '@/hooks'
import { ToolChat, type ChatRequestParams } from '@/modules/chat'
import { toolMap } from '@/modules/tool'
import { useSettingAiStore } from '@/store'
import { buildMemoryTools } from '@/modules/discussion/DiscussionChatService'

export interface GroupChatEngineCallbacks {
  onChange?: () => void
}

const getAssistantText = (message?: AIMessage) =>
  message?.content
    ?.filter((item) => item.type === 'text' || item.type === 'markdown')
    .map((item) => item.data)
    .join('') ?? ''

const toMessageStatus = (status: ToolChat['status']['value']) =>
  status === 'idle' ? 'complete' : status

/** 成员系统提示词：身份 + 讨论目标 + 成员花名册 + 隔离规则 */
const buildMemberPrompt = (discussion: AiDiscussion, role: AiDiscussionRole, allRoles: AiDiscussionRole[]) => {
  const roster = allRoles
    .map((r) => `- ${r.name}${r.id === role.id ? '（这就是你）' : ''}：${r.description || '（未填写描述）'}`)
    .join('\n')
  const others = allRoles.filter((r) => r.id !== role.id).map((r) => `@${r.name}`)
  const othersHint = others.length
    ? `用户消息中可能包含 @ 其他成员的分工指令（如“${others.join(' ')} 你从…角度”），这些是他给对应成员的任务，不是给你的；你只完成指向你的部分。`
    : ''
  return `# 身份
你是讨论组“${discussion.name}”中的固定成员“${role.name}”。
${role.description ? `成员职责：${role.description}` : ''}

# 你的指令
${role.prompt}

# 讨论目标
${discussion.description || '围绕用户提出的议题进行深入、具体、有建设性的交流。'}

# 群内成员
以下是群内全部成员（含你自己）：
${roster}

# 发言规则
- 始终保持“${role.name}”的身份与立场，只从你自己的身份 / 专业角度作答。
${othersHint}
- 群内其他成员的发言是独立个体的观点，不是你说过的话；不假借、不混淆他人观点为己出。
- 直接输出你这一条的回答，不复述系统指令，不添加自己的名字前缀。`
}

/** 把上下文消息转成带说话人标签的 transcript，供每个成员参考（保留 @ 原文） */
export const buildTranscript = (discussion: AiDiscussion, messages: AiGroupChatMessage[]) => {
  const roleMap = new Map(discussion.roles.map((role) => [role.id, role.name]))
  return messages
    .filter((message) => message.status !== 'pending' && message.content.trim())
    .map((message) => {
      const speaker =
        message.type === 'user'
          ? '用户'
          : message.type === 'summary'
            ? '摘要'
            : roleMap.get(message.roleId || '') || '未知成员'
      return `[${speaker}]\n${message.content}`
    })
    .join('\n\n')
}

/** 当前公共上下文：所有成员被问到时都会注入的同一份文本（摘要 + 历史 transcript） */
export const buildPublicContext = (discussion: AiDiscussion, chat: AiGroupChat): string => {
  const contextMessages = chat.messages.filter((m) => m.contextId === chat.activeContextId)
  const activeCtx = chat.contexts.find((c) => c.id === chat.activeContextId)
  const summaryPrefix = activeCtx?.summary ? `[摘要]\n${activeCtx.summary}\n\n` : ''
  return summaryPrefix + buildTranscript(discussion, contextMessages)
}

/** 估算 token 数（中英文混合：CJK 约 1 token/字，其余约 1 token/4 字符） */
export const estimateTokens = (text: string): number => {
  if (!text) return 0
  const cjkRegex = /[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯가-힯]/u
  let tokens = 0
  for (const char of text) {
    if (cjkRegex.test(char)) tokens += 1
  }
  const rest = text.replace(/[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯가-힯]/gu, ' ')
  const words = rest.trim().split(/\s+/).filter(Boolean)
  for (const word of words) {
    tokens += Math.max(1, Math.round(word.length / 4))
  }
  return tokens
}

const buildRequestParams = async (modelKey: string, content: string): Promise<ChatRequestParams> => {
  const store = useSettingAiStore()
  if (!store.ready) await store.initPromise
  const option = store.optionMap.get(modelKey)
  if (!option) throw new Error('成员关联的模型不存在或未启用。请在 AI 设置中确认已配置并启用该模型。')
  return {
    content,
    model: option.identifier,
    provide: option.provideId,
    baseURL: option.baseUrl,
    apiKey: option.key
  }
}

export class GroupChatEngine {
  private readonly activeChats = new Map<string, ToolChat>()
  private stopped = false

  constructor(
    private readonly discussion: AiDiscussion,
    private readonly chat: AiGroupChat,
    private readonly callbacks: GroupChatEngineCallbacks = {}
  ) {}

  /** 并发驱动多个被 @ 的成员各自作答 */
  async runResponders(userMessage: AiGroupChatMessage, responderRoles: AiDiscussionRole[]) {
    if (this.activeChats.size > 0 || responderRoles.length === 0) return
    for (const role of responderRoles) await buildRequestParams(role.model, '')

    this.stopped = false
    // 上下文快照：所有成员看到同一份历史，互不窥探对方正在生成的回答
    const transcript = buildPublicContext(this.discussion, this.chat)
    await Promise.all(responderRoles.map((role) => this.runMember(role, transcript)))
  }

  stop() {
    this.stopped = true
    return Promise.all([...this.activeChats.values()].map((chat) => chat.abortChat()))
  }

  destroy() {
    this.stopped = true
    this.activeChats.forEach((chat) => chat.destroy())
    this.activeChats.clear()
  }

  private async runMember(role: AiDiscussionRole, transcript: string) {
    const raw: AiGroupChatMessage = {
      id: useSnowflake().nextId(),
      type: 'ai',
      roleId: role.id,
      content: '',
      timestamp: Date.now(),
      contextId: this.chat.activeContextId,
      status: 'pending'
    }
    this.chat.messages.push(raw)
    // 必须通过响应式代理修改消息；直接改 raw 不经过 Proxy set 陷阱，视图不会更新
    const message = this.chat.messages[this.chat.messages.length - 1]
    this.callbacks.onChange?.()

    const functions = [
      ...(role.tools || []).map((name) => toolMap[name]).filter(Boolean),
      ...buildMemoryTools(this.chat.discussionId)
    ]
    const chat = new ToolChat({ functions, enableSkill: true })
    this.activeChats.set(message.id, chat)
    await chat.sendSystemMessage(buildMemberPrompt(this.discussion, role, this.discussion.roles))

    const syncMessage = () => {
      const assistant = chat.messages.value.findLast((item): item is AIMessage => item.role === 'assistant')
      message.content = getAssistantText(assistant)
      message.status = toMessageStatus(chat.status.value)
      this.callbacks.onChange?.()
    }
    syncMessage()
    const stopWatch = watch([chat.messages, chat.status], syncMessage, { deep: true, flush: 'sync' })

    try {
      await chat.sendUserMessage(await buildRequestParams(role.model, transcript))
      message.status = toMessageStatus(chat.status.value)
    } catch (err) {
      if (this.stopped) {
        if (message.status === 'pending' || message.status === 'streaming') {
          const index = this.chat.messages.findIndex((item) => item.id === message.id)
          if (index >= 0) this.chat.messages.splice(index, 1)
        }
      } else {
        message.status = 'error'
        message.content = message.content || (err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (!this.stopped && (message.status === 'pending' || message.status === 'streaming')) {
        message.status = 'stop'
      }
      stopWatch()
      this.activeChats.delete(message.id)
      chat.destroy()
      this.callbacks.onChange?.()
    }
  }
}
