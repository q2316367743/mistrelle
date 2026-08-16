import type { AiRequestParams, AiStreamChunk, AiUsage } from '../types'
import type { SseFrame } from '../sse'
import { AiFormatAdapter } from './types'
import { isRecord, normalizeBase, safeJsonParse, strField, toUsage } from './util'

/** Anthropic 缺省 max_tokens（Messages API 必填） */
const DEFAULT_MAX_TOKENS = 4096

/**
 * Anthropic Messages API（{base}/v1/messages）适配器。
 * - 认证头 x-api-key + anthropic-version；system 是顶层字段而非消息角色；
 * - assistant 工具调用是 content 块 { type: 'tool_use' }，工具结果是 { type: 'tool_result' }；
 * - SSE 事件：message_start(输入 usage) → content_block_start(tool id/name) →
 *   content_block_delta(text_delta / thinking_delta / input_json_delta) →
 *   message_delta(输出 usage + stop_reason) → message_stop。
 */
export const createAnthropicAdapter = (): AiFormatAdapter => {
  let inputTokens: number | undefined
  let outputTokens: number | undefined

  return {
    buildRequest(params: AiRequestParams, stream: boolean) {
      const system = params.messages
        .filter((msg) => msg.role === 'system')
        .map((msg) => msg.content ?? '')
        .join('\n')

      const messages: unknown[] = []
      for (const msg of params.messages) {
        if (msg.role === 'system') continue
        if (msg.role === 'user') {
          messages.push({ role: 'user', content: [{ type: 'text', text: msg.content ?? '' }] })
        } else if (msg.role === 'tool') {
          messages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: msg.tool_call_id ?? '',
                content: msg.content ?? ''
              }
            ]
          })
        } else if (msg.role === 'assistant') {
          const blocks: unknown[] = []
          if (msg.content) blocks.push({ type: 'text', text: msg.content })
          for (const call of msg.tool_calls ?? []) {
            blocks.push({
              type: 'tool_use',
              id: call.id,
              name: call.function.name,
              input: safeJsonParse(call.function.arguments, {})
            })
          }
          messages.push({ role: 'assistant', content: blocks })
        }
      }

      const baseMaxTokens = params.maxTokens ?? DEFAULT_MAX_TOKENS
      const body: Record<string, unknown> = {
        model: params.model,
        messages,
        max_tokens: baseMaxTokens,
        stream
      }
      if (system) body.system = system
      if (params.tools && params.tools.length > 0) {
        body.tools = params.tools.map((tool) => ({
          name: tool.function.name,
          description: tool.function.description,
          input_schema: tool.function.parameters
        }))
      }
      if (params.thinking === true) {
        // thinking 启用时 budget_tokens 须 ≥1024 且 max_tokens 必须大于 budget
        const budget = Math.min(8192, Math.max(1024, Math.floor(baseMaxTokens / 2)))
        body.thinking = { type: 'enabled', budget_tokens: budget }
        if (baseMaxTokens <= budget) body.max_tokens = budget + 1024
      }
      if (params.bodyOverride) Object.assign(body, params.bodyOverride)

      const base = normalizeBase(params.baseURL).replace(/\/v1$/, '')
      return {
        url: `${base}/v1/messages`,
        headers: {
          'anthropic-version': '2023-06-01',
          ...(params.apiKey ? { 'x-api-key': params.apiKey } : {}),
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

      if (type === 'message_start') {
        const message = isRecord(data['message']) ? data['message'] : undefined
        const usage = toUsage(message?.['usage'])
        inputTokens = usage?.prompt_tokens
      } else if (type === 'content_block_start') {
        const block = isRecord(data['content_block']) ? data['content_block'] : undefined
        const index = typeof data['index'] === 'number' ? (data['index'] as number) : 0
        if (block && block['type'] === 'tool_use') {
          chunks.push({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index,
                      id: strField(block, 'id'),
                      function: { name: strField(block, 'name') }
                    }
                  ]
                }
              }
            ]
          })
        }
      } else if (type === 'content_block_delta') {
        const delta = isRecord(data['delta']) ? data['delta'] : undefined
        const index = typeof data['index'] === 'number' ? (data['index'] as number) : 0
        if (!delta) return []
        const deltaType = strField(delta, 'type')
        if (deltaType === 'text_delta') {
          const text = strField(delta, 'text')
          if (text) chunks.push({ choices: [{ delta: { content: text } }] })
        } else if (deltaType === 'thinking_delta') {
          const thinking = strField(delta, 'thinking')
          if (thinking) chunks.push({ choices: [{ delta: { reasoning_content: thinking } }] })
        } else if (deltaType === 'input_json_delta') {
          const partial = strField(delta, 'partial_json')
          if (partial) {
            chunks.push({
              choices: [{ delta: { tool_calls: [{ index, function: { arguments: partial } }] } }]
            })
          }
        }
      } else if (type === 'message_delta') {
        const delta = isRecord(data['delta']) ? data['delta'] : undefined
        const usage = toUsage(data['usage'])
        if (usage) outputTokens = usage.completion_tokens
        if (outputTokens !== undefined) {
          const total: AiUsage = {
            prompt_tokens: inputTokens ?? 0,
            completion_tokens: outputTokens,
            total_tokens: (inputTokens ?? 0) + outputTokens
          }
          chunks.push({
            usage: total,
            choices: [
              { finish_reason: mapStopReason(strField(delta ?? {}, 'stop_reason')), delta: {} }
            ]
          })
        }
      }

      return chunks
    }
  }
}

const mapStopReason = (reason?: string): string | undefined => {
  if (reason === 'end_turn' || reason === 'stop_sequence') return 'stop'
  if (reason === 'max_tokens') return 'length'
  if (reason === 'tool_use') return 'tool_calls'
  return reason
}
