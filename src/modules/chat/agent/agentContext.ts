import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall
} from 'openai/resources/chat/completions'
import type {
  AIMessage,
  AIMessageContent,
  ChatMessage,
  TextContent,
  ToolCallContent
} from '@/domain'
import { parseSkillCommand } from '@/modules/skill'
import type { AssistantRequestMessage } from './agentTypes'

const SKILL_TOOL_NAMES = new Set(['load_skill', 'read_skill_file'])

const getReferenceContext = (ext: unknown): string => {
  if (!ext || typeof ext !== 'object' || !('referenceContext' in ext)) return ''
  return typeof ext.referenceContext === 'string' ? ext.referenceContext : ''
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
          arguments: item.data.args ?? '{}'
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

export const toAgentRequestMessages = (
  messages: ChatMessage[],
  activeAssistantMessageId: string
): ChatCompletionMessageParam[] => {
  const out: ChatCompletionMessageParam[] = []

  for (const message of messages) {
    if (message.role === 'user') {
      const rawContent = message.content
        .filter((item): item is TextContent => item.type === 'text')
        .map((item) => item.data)
        .join('')
      const command = parseSkillCommand(rawContent)
      const content = command && command.rest.length > 0 ? command.rest : rawContent
      out.push({
        role: 'user',
        content: `${content}${getReferenceContext(message.ext)}`
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
