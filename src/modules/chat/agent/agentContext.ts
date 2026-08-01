import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall
} from 'openai/resources/chat/completions'
import type {
  AIMessage,
  AIMessageContent,
  ChatMessage,
  SkillContent,
  TextContent,
  ToolCallContent,
  ToolContent
} from '@/domain'
import { toolMap } from '@/modules/tool'
import type { AssistantRequestMessage } from './agentTypes'

// 不进入历史回传的工具调用：避免旧参数 / 旧结果污染上下文，其状态由每轮独立注入提供
const SKILL_TOOL_NAMES = new Set(['load_skill', 'read_skill_file', 'update_todo'])

/** 根据 tool 定义的 stripFields 剥离历史 args 中的冗余字段（如写入内容），节省 token */
const slimToolArgs = (toolName: string, args: string | undefined): string => {
  const raw = args ?? '{}'
  const stripFields = toolMap[toolName]?.stripFields
  if (!stripFields || stripFields.length === 0) return raw
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    for (const field of stripFields) delete parsed[field]
    return JSON.stringify(parsed)
  } catch {
    return raw
  }
}

const getText = (contents: AIMessageContent[]): string =>
  contents
    .filter((item) => item.type === 'text' || item.type === 'markdown')
    .map((item) => item.data)
    .join('')

const getReasoning = (contents: AIMessageContent[]): string =>
  contents
    .filter((item) => item.type === 'thinking')
    .map((item) => item.data.text ?? '')
    .join('')

const appendAssistantStep = (
  out: ChatCompletionMessageParam[],
  contents: AIMessageContent[],
  filterSkillTools: boolean
): void => {
  const toolContents = contents.filter(
    (item): item is ToolCallContent =>
      item.type === 'toolcall' &&
      (!filterSkillTools || !SKILL_TOOL_NAMES.has(item.data.toolCallName))
  )
  const text = getText(contents)
  const reasoning = getReasoning(contents)
  if (!text && !reasoning && toolContents.length === 0) return

  const assistantMessage: AssistantRequestMessage = {
    role: 'assistant',
    content: text || (toolContents.length > 0 ? null : '')
  }
  if (reasoning) assistantMessage.reasoning_content = reasoning
  if (toolContents.length > 0) {
    assistantMessage.tool_calls = toolContents.map(
      (item): ChatCompletionMessageToolCall => ({
        id: item.data.toolCallId,
        type: 'function',
        function: {
          name: item.data.toolCallName,
          arguments: slimToolArgs(item.data.toolCallName, item.data.args)
        }
      })
    )
  }
  out.push(assistantMessage)

  for (const item of toolContents) {
    out.push({
      role: 'tool',
      tool_call_id: item.data.toolCallId,
      content: item.data.result ?? ''
    })
  }
}

const appendAssistantMessage = (
  out: ChatCompletionMessageParam[],
  message: AIMessage,
  filterSkillTools: boolean
): void => {
  const contents = message.content ?? []
  let step: AIMessageContent[] = []
  let stepId: string | undefined

  const flush = () => {
    appendAssistantStep(out, step, filterSkillTools)
    step = []
    stepId = undefined
  }

  for (const content of contents) {
    if (content.stepId) {
      if (step.length > 0 && stepId !== content.stepId) flush()
      stepId = content.stepId
      step.push(content)
      continue
    }

    // 旧记录没有 stepId：工具后的非工具内容视为下一次模型响应。
    if (step.some((item) => item.type === 'toolcall') && content.type !== 'toolcall') flush()
    step.push(content)
    if (content.type === 'toolcall') stepId = undefined
  }
  flush()
}

/**
 * 把用户消息中显式指定的 Skill / 工具渲染成给模型的指令文本。
 * 仅识别结构化的 SkillContent / ToolContent（UI 输入框引用产生），不做文本解析与兼容。
 * 返回空串表示该消息无显式指定；调用方只把它拼到当前用户消息上，不进入 system 前缀。
 */
const buildPinnedContext = (msg: ChatMessage): string => {
  if (msg.role !== 'user') return ''
  const skills = msg.content.filter((c): c is SkillContent => c.type === 'skill')
  const tools = msg.content.filter((c): c is ToolContent => c.type === 'tool')
  if (skills.length === 0 && tools.length === 0) return ''

  const parts: string[] = []
  if (skills.length > 0) {
    const list = skills
      .map((s) => `- Skill「${s.data.name}」：请调用 load_skill("${s.data.name}") 加载完整指令并严格遵循`)
      .join('\n')
    parts.push(`用户在本条消息中指定了以下 Skill，请直接加载并遵循（无需再确认）：\n${list}`)
  }
  if (tools.length > 0) {
    const list = tools
      .map((t) => `- 工具「${t.data.label}」（调用名 ${t.data.name}）：请直接调用 ${t.data.name} 执行`)
      .join('\n')
    parts.push(`用户在本条消息中指定了以下工具，请直接调用（无需再确认）：\n${list}`)
  }
  return parts.join('\n\n')
}

export const toAgentRequestMessages = (
  messages: ChatMessage[],
  activeAssistantMessageId: string,
  activeReferenceContext = ''
): ChatCompletionMessageParam[] => {
  const out: ChatCompletionMessageParam[] = []
  const activeAssistantIndex = messages.findIndex((message) => message.id === activeAssistantMessageId)
  const activeUserIndex = activeAssistantIndex > 0 ? activeAssistantIndex - 1 : -1

  for (const [index, message] of messages.entries()) {
    if (message.role === 'user') {
      const content = message.content
        .filter((item): item is TextContent => item.type === 'text')
        .map((item) => item.data)
        .join('')
      let extra = ''
      if (index === activeUserIndex) {
        // 当前用户消息：引用文件上下文 + 显式指定的 skill/工具 指令，二者都不进 system 前缀
        const ref = activeReferenceContext.replace(/^\n+/, '')
        const pinned = buildPinnedContext(message)
        extra = [ref, pinned].filter(Boolean).join('\n\n')
      }
      out.push({
        role: 'user',
        content: extra ? `${content}\n\n${extra}` : content
      })
      continue
    }

    if (message.role === 'system') {
      out.push({
        role: 'system',
        content: message.content
          .filter((item): item is TextContent => item.type === 'text')
          .map((item) => item.data)
          .join('')
      })
      continue
    }

    appendAssistantMessage(out, message, message.id !== activeAssistantMessageId)
  }

  return out
}
