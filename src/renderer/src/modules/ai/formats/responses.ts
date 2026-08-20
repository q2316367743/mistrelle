import type { AiRequestParams, AiStreamChunk, AiToolCallDelta } from '../types'
import type { SseFrame } from '../sse'
import { AiFormatAdapter } from './types'
import { isRecord, normalizeBase, strField, toStreamError, toUsage } from './util'

/**
 * OpenAI Responses API（/responses）适配器（DeepSeek 亦兼容此协议）。
 * - 语义化 SSE 事件，无 `[DONE]`，以 response.completed / response.incomplete 收尾；
 * - tool_calls 由 `response.function_call_arguments.delta`（携带 output_index）与
 *   `response.output_item.done`（携带 call_id/name，无 index）共同构成，需按完成顺序对齐索引。
 */
export const createResponsesAdapter = (): AiFormatAdapter => {
  /** 出现 arguments delta 的 output_index 队列（output 项按顺序完成，done 时出队对齐） */
  const pendingArgIndices: number[] = []

  return {
    buildRequest(params: AiRequestParams, stream: boolean) {
      const input: unknown[] = []
      for (const msg of params.messages) {
        if (msg.role === 'system' || msg.role === 'user') {
          input.push({
            role: msg.role,
            content: [{ type: 'input_text', text: msg.content ?? '' }]
          })
        } else if (msg.role === 'tool') {
          input.push({
            type: 'function_call_output',
            call_id: msg.tool_call_id ?? '',
            output: msg.content ?? ''
          })
        } else if (msg.role === 'assistant') {
          if (msg.content) {
            input.push({
              type: 'message',
              role: 'assistant',
              content: [{ type: 'output_text', text: msg.content }]
            })
          }
          for (const call of msg.tool_calls ?? []) {
            input.push({
              type: 'function_call',
              call_id: call.id,
              name: call.function.name,
              arguments: call.function.arguments
            })
          }
        }
      }

      const body: Record<string, unknown> = {
        model: params.model,
        input,
        stream
      }
      if (params.tools && params.tools.length > 0) {
        body.tools = params.tools.map((tool) => ({
          type: 'function',
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters
        }))
      }
      if (typeof params.thinking === 'boolean') {
        // DeepSeek responses 默认思考开启；thinking 显式传值才写 reasoning
        body.reasoning = {
          effort: params.thinking ? mapReasoningEffort(params.reasoningEffort) : 'none'
        }
      }
      if (params.bodyOverride) Object.assign(body, params.bodyOverride)
      return {
        url: `${normalizeBase(params.baseURL)}/responses`,
        // 缺省注入 Bearer 认证（可被 onRequest 的 headers 覆盖）
        headers: {
          ...(params.apiKey ? { Authorization: `Bearer ${params.apiKey}` } : {}),
          ...(params.headers ?? {})
        },
        body
      }
    },

    normalizeChunk(frame: SseFrame): AiStreamChunk[] {
      if (!frame.data) return []
      let data: unknown
      try {
        data = JSON.parse(frame.data)
      } catch {
        return []
      }
      if (!isRecord(data)) return []
      const type = strField(data, 'type') ?? ''
      const chunks: AiStreamChunk[] = []

      if (type === 'response.output_text.delta') {
        const text = strField(data, 'delta')
        if (text) {
          chunks.push({ choices: [{ delta: { content: text } }] })
        }
      } else if (
        type === 'response.reasoning_summary_text.delta' ||
        type === 'response.reasoning_text.delta'
      ) {
        const text = strField(data, 'delta')
        if (text) {
          chunks.push({ choices: [{ delta: { reasoning_content: text } }] })
        }
      } else if (type === 'response.function_call_arguments.delta') {
        const delta = strField(data, 'delta')
        const outputIndex =
          typeof data['output_index'] === 'number' ? (data['output_index'] as number) : -1
        if (delta && outputIndex >= 0) {
          pendingArgIndices.push(outputIndex)
          chunks.push({
            choices: [
              { delta: { tool_calls: [{ index: outputIndex, function: { arguments: delta } }] } }
            ]
          })
        }
      } else if (type === 'response.output_item.done') {
        const output = isRecord(data['output']) ? data['output'] : undefined
        if (output && output['type'] === 'function_call') {
          const index = pendingArgIndices.shift() ?? 0
          const toolCall: AiToolCallDelta = { index }
          const callId = strField(output, 'call_id')
          const name = strField(output, 'name')
          if (callId) toolCall.id = callId
          if (name) toolCall.function = { name }
          chunks.push({ choices: [{ delta: { tool_calls: [toolCall] } }] })
        }
      } else if (type === 'response.failed') {
        // 失败事件转可见错误（response.error 含 code/message，code 非数字则按普通 Error 可重试）
        const response = isRecord(data['response']) ? data['response'] : undefined
        throw toStreamError(response?.['error'] ?? data)
      } else if (type === 'response.completed') {
        const response = isRecord(data['response']) ? data['response'] : undefined
        chunks.push({
          usage: toUsage(response?.['usage']),
          choices: [{ finish_reason: 'stop', delta: {} }]
        })
      } else if (type === 'response.incomplete') {
        chunks.push({ choices: [{ finish_reason: 'length', delta: {} }] })
      }

      return chunks
    }
  }
}

/** 归一思考强度：chat 侧是 low/medium/high，responses 侧按文档可传 none/minimal/low/medium/high/xhigh/max */
const mapReasoningEffort = (effort?: string): string => {
  if (!effort) return 'medium'
  if (effort === 'low' || effort === 'medium' || effort === 'high') return effort
  return 'medium'
}
