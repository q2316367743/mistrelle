import type { AiMessageParam, AiTool } from '@/modules/ai'
import { createChatStream, isHttpError } from '@/modules/ai'
import type { Ref } from 'vue'
import type { ChatMessage, ChatUsage } from '@/domain'
import {
  extractReasoningContent,
  finishReasonToStatus,
  type ResolvedChatRequestParams,
  type ChatServiceConfig,
  type SSEChunkData
} from '@/modules/chat'
import { nanoid } from 'nanoid'
import { useLog } from '@/hooks/UseLog'
import {
  appendAssistantContent,
  removeStepContents,
  setAssistantStatus,
  upsertStepNotice
} from './agentMessages'
import type { StreamStepResult, ToolCall } from './agentTypes'

/** 单步请求失败后的最大自动重试次数（不含首次请求），ChatServiceConfig.maxRetries 可覆盖 */
const DEFAULT_MAX_RETRIES = 3
/** 重试退避基准间隔（毫秒），实际等待 retryInterval * 2^已重试次数（2s → 4s → 8s） */
const DEFAULT_RETRY_INTERVAL = 2000

const logger = useLog({ name: 'chat:agent-stream' })

type StreamOptions = {
  messages: Ref<ChatMessage[]>
  assistantMessageId: string
  requestParams: ResolvedChatRequestParams
  apiMessages: AiMessageParam[]
  tools: AiTool[]
  config: ChatServiceConfig
  signal: AbortSignal
  seq: number
  currentSeq: () => number
}

/** 可重试错误：网络/流中断（无状态码的普通 Error）与 HTTP 429/5xx；其余 4xx 为鉴权/参数错误，重试无意义 */
const isRetryableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false
  if (error.name === 'AbortError') return false
  if (isHttpError(error)) return error.status === 429 || error.status >= 500
  // axios 未走 HttpError 时仍可能是「Request failed with status code 403」；4xx 重试无意义
  const statusMatch = error.message.match(/status code (\d{3})/i)
  if (statusMatch) {
    const status = Number(statusMatch[1])
    return status === 429 || status >= 500
  }
  return true
}

/** 可被 signal 打断的延时：中止时抛 AbortError，交由上层走既有「停止」路径 */
const abortableDelay = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      const reason = signal.reason
      reject(reason instanceof Error ? reason : new DOMException('Aborted', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
  })

const toStringHeaders = (headers: unknown): Record<string, string> => {
  if (headers instanceof Headers) {
    const entries: Array<[string, string]> = []
    headers.forEach((value, key) => entries.push([key, value]))
    return Object.fromEntries(entries)
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(
      headers.filter(
        (entry): entry is [string, string] =>
          Array.isArray(entry) &&
          entry.length === 2 &&
          typeof entry[0] === 'string' &&
          typeof entry[1] === 'string'
      )
    )
  }
  if (!headers || typeof headers !== 'object') return {}
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)]))
}

export const streamAgentStep = async (options: StreamOptions): Promise<StreamStepResult> => {
  // onRequest 覆盖：body 为格式原生覆盖项（chat 透传 thinking 等），headers 透传。
  // 每个重试序列仅计算一次，重试复用相同请求参数
  let bodyOverride: Record<string, unknown> | undefined
  let requestHeaders: Record<string, string> = {}
  const modified = await options.config.onRequest?.(options.requestParams)
  if (modified) {
    const customBody: unknown = Reflect.get(modified, 'body')
    if (customBody && typeof customBody === 'object') {
      bodyOverride = customBody as Record<string, unknown>
    }
    requestHeaders = toStringHeaders(modified.headers)
  }

  options.config.onStart?.('')
  setAssistantStatus(options.messages, options.assistantMessageId, 'streaming')

  const maxRetries = options.config.maxRetries ?? DEFAULT_MAX_RETRIES
  const retryInterval = options.config.retryInterval ?? DEFAULT_RETRY_INTERVAL
  // 重试提示块标识：同一重试序列内原地更新同一块，跨步骤 / 续跑不串扰；首次失败时生成
  let retryKey = ''

  /** 单次尝试：发起请求并消费流。stepId 每次尝试新生成，失败重试前按它清理已写入的半截内容 */
  const runOnce = async (stepId: string): Promise<StreamStepResult> => {
    // 内置供应商（服务端中转）经 createChatStream 内部分流走主进程 relay IPC
    const stream = createChatStream({
      baseURL: options.requestParams.baseURL,
      apiKey: options.requestParams.apiKey,
      format: options.requestParams.format ?? 'chat',
      model: options.requestParams.message.model,
      messages: options.apiMessages,
      tools: options.tools,
      thinking:
        typeof options.requestParams.message.thinking === 'boolean'
          ? options.requestParams.message.thinking
          : undefined,
      reasoningEffort: options.requestParams.message.reasoning_effort,
      signal: options.signal,
      headers: requestHeaders,
      bodyOverride,
      sessionId: options.requestParams.sessionId,
      builtin: options.requestParams.builtin
    })

    const accumulated = new Map<number, { id: string; name: string; args: string }>()
    let finishReason: string | null | undefined
    let usage: ChatUsage | undefined
    // 是否收到过可渲染内容（正文 / 思考 / 工具调用增量），用于空流告警
    let receivedContent = false
    for await (const chunk of stream) {
      if (options.seq !== options.currentSeq()) return { cancelled: true, toolCalls: [], usage }
      // usage 常出现在末个 chunk（choices 为空），需在跳过前捕获
      if (chunk.usage) {
        usage = {
          promptTokens: chunk.usage.prompt_tokens,
          completionTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens
        }
      }
      const choice = chunk.choices?.[0]
      if (!choice) continue
      const sseChunk: SSEChunkData = { data: chunk, event: 'data' }
      if (options.config.isValidChunk && !options.config.isValidChunk(sseChunk)) continue
      // 仅在真值时更新：后续不带 finish_reason 的帧不得抹掉已收到的终局标记
      if (choice.finish_reason) finishReason = choice.finish_reason
      const delta = choice.delta
      const reasoning = extractReasoningContent(delta)
      if (reasoning) {
        receivedContent = true
        appendAssistantContent(options.messages, options.assistantMessageId, {
          type: 'thinking',
          stepId,
          data: { text: reasoning, title: '正在思考' },
          status: 'streaming',
          time: Date.now()
        })
      }
      if (delta.content) {
        receivedContent = true
        appendAssistantContent(options.messages, options.assistantMessageId, {
          type: 'markdown',
          stepId,
          data: delta.content,
          status: 'streaming',
          time: Date.now()
        })
      }
      for (const toolCall of delta.tool_calls ?? []) {
        const index = toolCall.index
        const current = accumulated.get(index) ?? { id: '', name: '', args: '' }
        if (toolCall.id) current.id = toolCall.id
        if (toolCall.function?.name) current.name = toolCall.function.name
        if (toolCall.function?.arguments) current.args += toolCall.function.arguments
        accumulated.set(index, current)
      }
    }

    if (options.seq !== options.currentSeq()) return { cancelled: true, toolCalls: [], usage }
    // 中止落在流中段时 preload 桥按正常收尾返回（break 而非报错），此处转为取消，
    // 交由上层走既有「停止」路径，避免半截内容被误标为完整回答
    if (options.signal.aborted) return { cancelled: true, toolCalls: [], usage }
    // 流完整性校验：无 finish_reason 且无工具调用 = 连接被提前切断（半截内容）或 200 非 SSE
    // 响应体（0 帧，JSON 解析失败帧已被适配器静默丢弃）。不抛错则界面无声终止或半截被当完整回答；
    // 抛普通 Error 走下方既有重试（重试前 removeStepContents 清理半截内容），耗尽后错误气泡可见
    if (finishReason == null && accumulated.size === 0) {
      logger.warn('流提前结束，未收到完整响应', {
        model: options.requestParams.message.model,
        baseURL: options.requestParams.baseURL,
        receivedContent
      })
      throw new Error('流提前结束，未收到完整响应（连接可能被中断或响应体异常）')
    }
    // finish_reason 声明 tool_calls 却无增量数据（非流式形状 / 截断）：按错误重试，否则调用被静默丢弃
    if (finishReason === 'tool_calls' && accumulated.size === 0) {
      throw new Error('模型请求调用工具但未收到工具调用数据')
    }
    // 工具参数落历史前校验 JSON：模型偶发生成非法参数（多余引号/语法残缺），一旦入库，
    // 本会话后续每轮请求都会被服务端以参数解析失败拒绝（实测 200 + error 帧循环失败，会话 brick）。
    // 非法按普通 Error 抛出走既有重试，重掷大概率得到合法 JSON；空串放行（无参工具，执行器回退 {}）
    for (const call of accumulated.values()) {
      if (!call.args) continue
      try {
        JSON.parse(call.args)
      } catch (e) {
        throw new Error(
          `工具调用参数 JSON 非法（${call.name || '未知工具'}）：${e instanceof Error ? e.message : String(e)}`
        )
      }
    }
    const toolCalls: ToolCall[] = Array.from(accumulated.values()).map((call) => ({
      toolCallId: call.id || `call_${nanoid()}`,
      toolCallName: call.name,
      args: call.args,
      stepId,
      parentMessageId: options.assistantMessageId
    }))
    for (const call of toolCalls) {
      appendAssistantContent(options.messages, options.assistantMessageId, {
        type: 'toolcall',
        stepId,
        status: 'pending',
        data: {
          toolCallId: call.toolCallId,
          toolCallName: call.toolCallName,
          args: call.args
        },
        time: Date.now()
      })
    }
    // 存在待执行的工具调用时保持「执行中」：部分厂商在带 tool_calls 的返回里 finish_reason 仍是
    // stop，若按 finishReason 置为 complete，会让整条 assistant 消息在工具真正执行前就显示已完成
    if (toolCalls.length > 0) {
      setAssistantStatus(options.messages, options.assistantMessageId, 'streaming')
    } else {
      setAssistantStatus(
        options.messages,
        options.assistantMessageId,
        finishReasonToStatus(finishReason)
      )
    }
    return { cancelled: false, finishReason, toolCalls, usage }
  }

  for (let attempt = 0; ; attempt++) {
    const stepId = nanoid()
    try {
      const result = await runOnce(stepId)
      if (attempt > 0) {
        upsertStepNotice(
          options.messages,
          options.assistantMessageId,
          retryKey,
          `已自动重试 ${attempt} 次，请求恢复`
        )
      }
      return result
    } catch (error) {
      console.error(error)
      // 中止不重试（走既有「停止」路径）；过期请求（新一轮已开始）静默取消
      if (options.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw error
      }
      if (options.seq !== options.currentSeq()) return { cancelled: true, toolCalls: [] }
      const message = error instanceof Error ? error.message : String(error)
      if (attempt >= maxRetries || !isRetryableError(error)) {
        if (retryKey) {
          upsertStepNotice(
            options.messages,
            options.assistantMessageId,
            retryKey,
            `已自动重试 ${attempt} 次，仍未成功`
          )
        }
        throw error
      }
      if (!retryKey) retryKey = nanoid()
      // 清掉本次失败尝试已写入的半截内容，否则重试成功后同段文本出现两遍
      removeStepContents(options.messages, options.assistantMessageId, stepId)
      const delay = retryInterval * 2 ** attempt
      upsertStepNotice(
        options.messages,
        options.assistantMessageId,
        retryKey,
        `请求出错（${message}），${Math.round(delay / 1000)} 秒后自动重试（第 ${attempt + 1}/${maxRetries} 次）`
      )
      await abortableDelay(delay, options.signal)
    }
  }
}
