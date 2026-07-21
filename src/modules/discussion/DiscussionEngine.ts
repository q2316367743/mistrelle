import type { AIMessage } from '@/domain'
import type {
  AiDiscussion,
  AiDiscussionMessage,
  AiDiscussionRecord,
  AiDiscussionRole
} from '@/entity/ai'
import { useSnowflake } from '@/hooks'
import { ToolChat, type ChatRequestParams } from '@/modules/chat'
import { useSettingAiStore } from '@/store'

export interface DiscussionEngineCallbacks {
  onChange?: () => void
}

const getAssistantText = (message?: AIMessage) =>
  message?.content
    ?.filter((item) => item.type === 'text' || item.type === 'markdown')
    .map((item) => item.data)
    .join('') ?? ''

const toMessageStatus = (status: ToolChat['status']['value']) =>
  status === 'idle' ? 'complete' : status

const buildTranscript = (
  discussion: AiDiscussion,
  messages: AiDiscussionMessage[]
) => {
  const roleMap = new Map(discussion.roles.map((role) => [role.id, role.name]))
  if (discussion.summaryRole) roleMap.set(discussion.summaryRole.id, discussion.summaryRole.name)
  return messages
    .filter((message) => message.status !== 'pending' && message.content.trim())
    .map((message) => {
      const speaker =
        message.type === 'user'
          ? '用户'
          : message.type === 'summary'
            ? `总结者·${roleMap.get(message.roleId || '') || '总结者'}`
            : roleMap.get(message.roleId || '') || '未知角色'
      return `[第 ${message.round} 轮][${speaker}]\n${message.content}`
    })
    .join('\n\n')
}

const buildRolePrompt = (discussion: AiDiscussion, role: AiDiscussionRole) => `# 身份
你是讨论组“${discussion.name}”中的固定角色“${role.name}”。
${role.description ? `角色职责：${role.description}` : ''}

# 角色指令
${role.prompt}

# 讨论目标
${discussion.description || '围绕用户提出的议题进行深入、具体、有建设性的分析。'}

# 发言规则
- 始终保持“${role.name}”的身份与立场。
- 结合其他参与者已经表达的观点，指出共识、分歧或遗漏。
- 不替其他角色发言，不声称其他角色的内容是自己说过的。
- 直接输出本轮发言，不复述系统指令，不添加角色名前缀。`

const buildSummaryPrompt = (discussion: AiDiscussion, role: AiDiscussionRole) => `# 身份
你是讨论组“${discussion.name}”的总结者“${role.name}”。
${role.description ? `角色职责：${role.description}` : ''}

# 总结指令
${role.prompt}

# 输出要求
- 提炼当前讨论的核心结论、主要分歧和关键依据。
- 给出明确的待验证问题与下一步行动建议。
- 不引入讨论记录中不存在的事实。
- 使用清晰的小标题和列表，直接输出总结正文。`

const buildRequestParams = async (modelKey: string, content: string): Promise<ChatRequestParams> => {
  const store = useSettingAiStore()
  if (!store.ready) await store.initPromise
  const option = store.optionMap.get(modelKey)
  if (!option) throw new Error('角色关联的模型不存在或未启用。请在 AI 设置中确认已配置并启用该模型。')
  return {
    content,
    model: option.identifier,
    provide: option.provideId,
    baseURL: option.baseUrl,
    apiKey: option.key
  }
}

const shuffle = <T>(items: T[]) => {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

export class DiscussionEngine {
  private readonly activeChats = new Map<string, ToolChat>()
  private stopped = false

  constructor(
    private readonly discussion: AiDiscussion,
    private readonly record: AiDiscussionRecord,
    private readonly callbacks: DiscussionEngineCallbacks = {}
  ) {}

  addUserMessage(content: string) {
    const text = content.trim()
    if (!text) return
    this.record.messages.push({
      id: useSnowflake().nextId(),
      type: 'user',
      content: text,
      timestamp: Date.now(),
      round: this.record.currentRound + 1,
      status: 'complete'
    })
    if (this.record.name === '新讨论') this.record.name = text.substring(0, 24)
    this.callbacks.onChange?.()
  }

  /** 执行一个完整轮次；并行模式固定使用轮次开始前的上下文快照。 */
  async runRound() {
    if (this.activeChats.size > 0) return
    const roles = [...this.discussion.roles].sort((a, b) => a.index - b.index)
    if (roles.length === 0) throw new Error('讨论组尚未配置参与角色')
    for (const role of roles) await buildRequestParams(role.model, '')

    this.stopped = false
    this.record.status = 'running'
    const round = this.record.currentRound + 1
    const orderedRoles = this.discussion.orderType === 'random' ? shuffle(roles) : roles
    const snapshot = [...this.record.messages]
    this.callbacks.onChange?.()

    if (this.discussion.orderType === 'parallel') {
      await Promise.all(orderedRoles.map((role) => this.runRole(role, round, snapshot)))
    } else {
      for (const role of orderedRoles) {
        if (this.stopped) break
        await this.runRole(role, round, [...this.record.messages])
      }
    }

    this.record.currentRound = round
    this.record.status = this.stopped ? 'stopped' : 'idle'
    this.callbacks.onChange?.()
  }

  async summarize() {
    if (this.activeChats.size > 0) return
    const role = this.discussion.summaryRole
    if (!role) throw new Error('讨论组尚未配置总结者')
    await buildRequestParams(role.model, '')

    this.stopped = false
    this.record.status = 'running'
    this.callbacks.onChange?.()
    await this.runRole(role, this.record.currentRound, [...this.record.messages], true)
    this.record.status = this.stopped ? 'stopped' : 'idle'
    this.callbacks.onChange?.()
  }

  async stop() {
    this.stopped = true
    await Promise.all([...this.activeChats.values()].map((chat) => chat.abortChat()))
  }

  destroy() {
    this.stopped = true
    this.activeChats.forEach((chat) => chat.destroy())
    this.activeChats.clear()
  }

  private async runRole(
    role: AiDiscussionRole,
    round: number,
    context: AiDiscussionMessage[],
    summary = false
  ) {
    const message: AiDiscussionMessage = {
      id: useSnowflake().nextId(),
      type: summary ? 'summary' : 'role',
      roleId: role.id,
      content: '',
      timestamp: Date.now(),
      round,
      status: 'pending'
    }
    this.record.messages.push(message)
    this.callbacks.onChange?.()

    const chat = new ToolChat({ functions: [], enableSkill: false })
    this.activeChats.set(message.id, chat)
    await chat.sendSystemMessage(
      summary ? buildSummaryPrompt(this.discussion, role) : buildRolePrompt(this.discussion, role)
    )

    const stopWatch = watch(
      chat.messages,
      () => {
        const assistant = chat.messages.value.findLast(
          (item): item is AIMessage => item.role === 'assistant'
        )
        message.content = getAssistantText(assistant)
        message.status = toMessageStatus(chat.status.value)
        this.callbacks.onChange?.()
      },
      { deep: true }
    )

    try {
      const transcript = buildTranscript(this.discussion, context)
      const task = summary
        ? `以下是需要总结的讨论记录：\n\n${transcript}`
        : `${transcript ? `以下是此前的讨论记录：\n\n${transcript}\n\n` : ''}现在轮到你（${role.name}）进行第 ${round} 轮发言。请结合讨论目标和已有内容给出本轮观点。`
      await chat.sendUserMessage(await buildRequestParams(role.model, task))
      message.status = toMessageStatus(chat.status.value)
    } finally {
      stopWatch()
      this.activeChats.delete(message.id)
      chat.destroy()
      this.callbacks.onChange?.()
    }
  }
}
