import type { Ref } from 'vue'
import type { ChatMessage, ToolFunction } from '@/domain'
import type { ToolCall } from './agentTypes'
import { updateToolCallContent } from './agentMessages'
import { resolveToolPolicy, type ToolPolicyContext } from '@/modules/tool/toolPolicy'
import { MAX_TOOL_RESULT_BYTES } from '@/global/Constant'

type ConfirmHandler = (toolName: string, args: Record<string, unknown>) => Promise<boolean>

/**
 * 工具结果按字节截断，且保证不在多字节字符（中文等）中间切断，避免产生非法 UTF-8。
 * 超出上限时追加说明文本，提示模型该输出已被裁剪。
 */
const truncateToolResult = (text: string): string => {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(text)
  if (bytes.length <= MAX_TOOL_RESULT_BYTES) return text
  // 回退到字符边界：向前找到不超过上限的最后一个完整字符的起始字节
  let end = MAX_TOOL_RESULT_BYTES
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end--
  const kept = new TextDecoder().decode(bytes.subarray(0, end))
  return `${kept}\n\n[工具输出已截断：原始 ${bytes.length} 字节，超过上限 ${MAX_TOOL_RESULT_BYTES} 字节，仅保留前 ${encoder.encode(kept).length} 字节]`
}

const serializeResult = (value: unknown): string => {
  const text = typeof value === 'string' ? value : (JSON.stringify(value) ?? '')
  return truncateToolResult(text)
}

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
  policyContext: ToolPolicyContext,
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

    const verdict = resolveToolPolicy(fn, args, policyContext)
    if (verdict === 'deny') {
      call.result = '该操作被安全策略拦截'
      updateToolCallContent(messages, assistantMessageId, call.toolCallId, call.result)
      continue
    }
    if (verdict === 'ask' && confirmHandler) {
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
