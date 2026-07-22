import type { Ref } from 'vue'
import type { ChatMessage, ToolFunction } from '@/domain'
import type { ToolCall } from './agentTypes'
import { updateToolCallContent } from './agentMessages'

type ConfirmHandler = (toolName: string, args: Record<string, unknown>) => Promise<boolean>

const serializeResult = (value: unknown): string =>
  typeof value === 'string' ? value : (JSON.stringify(value) ?? '')

const parseArguments = (raw: string | undefined): Record<string, unknown> => {
  const value: unknown = JSON.parse(raw ?? '{}')
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('工具参数必须是 JSON 对象')
  }
  return Object.fromEntries(Object.entries(value))
}

export const executeToolCalls = async (
  messages: Ref<ChatMessage[]>,
  assistantMessageId: string,
  calls: ToolCall[],
  functions: ToolFunction[],
  confirmHandler?: ConfirmHandler
): Promise<void> => {
  for (const call of calls) {
    const fn = functions.find((item) => item.name === call.toolCallName)
    if (!fn) {
      const result = `错误: 未找到工具 "${call.toolCallName}"`
      call.result = result
      updateToolCallContent(messages, assistantMessageId, call.toolCallId, result)
      continue
    }

    let args: Record<string, unknown>
    try {
      args = parseArguments(call.args)
    } catch (error: unknown) {
      const result = `错误: ${error instanceof Error ? error.message : String(error)}`
      call.result = result
      updateToolCallContent(messages, assistantMessageId, call.toolCallId, result)
      continue
    }

    if (fn.requireConfirm && confirmHandler) {
      const approved = await confirmHandler(fn.label || fn.name, args)
      if (!approved) {
        call.result = '用户拒绝了该工具调用'
        updateToolCallContent(messages, assistantMessageId, call.toolCallId, call.result)
        continue
      }
    }

    try {
      call.result = serializeResult(await fn.handler(args))
    } catch (error: unknown) {
      call.result = `错误: ${error instanceof Error ? error.message : String(error)}`
    }
    updateToolCallContent(messages, assistantMessageId, call.toolCallId, call.result)
  }
}
