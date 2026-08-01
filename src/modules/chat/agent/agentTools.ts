import type { Ref } from 'vue'
import type { ChatMessage, ToolFunction } from '@/domain'
import type { ToolCall } from './agentTypes'
import { markToolInteractive, updateToolCallContent } from './agentMessages'
import { resolveToolPolicy, type ToolPolicyContext } from '@/modules/tool/toolPolicy'
import { MAX_TOOL_RESULT_BYTES } from '@/global/Constant'
import type { InteractiveBridge } from './interactive'

const ASK_TOOL_NAME = 'ask'

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

export const parseArguments = (raw: string | undefined): Record<string, unknown> => {
  const value: unknown = JSON.parse(raw ?? '{}')
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('工具参数必须是 JSON 对象')
  }
  return Object.fromEntries(Object.entries(value))
}

const applyResult = (
  messages: Ref<ChatMessage[]>,
  assistantMessageId: string,
  call: ToolCall,
  result: string
): void => {
  call.result = result
  updateToolCallContent(messages, assistantMessageId, call.toolCallId, result)
}

/**
 * 执行单个工具：
 * - ask：直接挂起等用户选择，选择结果作为工具结果返回（不进 policy）
 * - 其余：按 policy 裁决，'ask' 时挂起等用户批准 / 拒绝，通过后执行 handler
 * 正常循环与 resume 复用同一路径。
 */
export const runSingleTool = async (
  messages: Ref<ChatMessage[]>,
  assistantMessageId: string,
  call: ToolCall,
  fn: ToolFunction,
  args: Record<string, unknown>,
  policyContext: ToolPolicyContext,
  interactive: InteractiveBridge
): Promise<void> => {
  if (fn.name === ASK_TOOL_NAME) {
    markToolInteractive(messages, assistantMessageId, call.toolCallId, 'ask')
    const answer = await interactive.awaitDecision('ask', call.toolCallId, args)
    const text = typeof answer === 'string' && answer.trim() ? answer.trim() : ''
    applyResult(
      messages,
      assistantMessageId,
      call,
      text ? `用户选择：${text}` : '用户未回答，请自行判断或继续推进任务'
    )
    return
  }

  const verdict = resolveToolPolicy(fn, args, policyContext)
  if (verdict === 'deny') {
    applyResult(messages, assistantMessageId, call, '该操作被安全策略拦截')
    return
  }
  if (verdict === 'ask') {
    markToolInteractive(messages, assistantMessageId, call.toolCallId, 'confirm')
    const approved = await interactive.awaitDecision('confirm', call.toolCallId, args)
    if (!approved) {
      applyResult(messages, assistantMessageId, call, '用户拒绝了该工具调用')
      return
    }
  }

  try {
    applyResult(messages, assistantMessageId, call, serializeResult(await fn.handler(args)))
  } catch (error: unknown) {
    applyResult(messages, assistantMessageId, call, `错误: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export const executeToolCalls = async (
  messages: Ref<ChatMessage[]>,
  assistantMessageId: string,
  calls: ToolCall[],
  functions: ToolFunction[],
  policyContext: ToolPolicyContext,
  interactive: InteractiveBridge
): Promise<void> => {
  for (const call of calls) {
    const fn = functions.find((item) => item.name === call.toolCallName)
    if (!fn) {
      applyResult(messages, assistantMessageId, call, `错误: 未找到工具 "${call.toolCallName}"`)
      continue
    }

    let args: Record<string, unknown>
    try {
      args = parseArguments(call.args)
    } catch (error: unknown) {
      applyResult(
        messages,
        assistantMessageId,
        call,
        `错误: ${error instanceof Error ? error.message : String(error)}`
      )
      continue
    }

    await runSingleTool(messages, assistantMessageId, call, fn, args, policyContext, interactive)
  }
}
