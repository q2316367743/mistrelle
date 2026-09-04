import type { AiMessageParam, AiTool } from '@/windows/main/modules/ai'
import type { ChatRequestParams } from '@/windows/main/modules/chat'
import { MAX_AGENT_STEPS } from '@/global/Constant'
import { estimateTokenBreakdown, normalizeTokenBreakdown } from '@/utils/tokenEstimate'
import {
  appendAssistantContent,
  setAssistantStatus,
  setAssistantTokenBreakdown,
  setAssistantUsage
} from './agentMessages'
import { streamAgentStep } from './agentStream'
import { executeToolCalls } from './agentTools'
import { buildAiTools, filterToolsByMode } from './agentFunctions'
import type { ToolChat } from './AgentChat'

/** 触顶收尾指令：子 Agent 步数耗尽时以独立 system 消息注入，强制其基于中间结果立即输出最终总结 */
const FINALIZE_PROMPT =
  '已到达最大迭代次数，请立即基于当前已收集的所有信息输出最终总结，直接给出结论，不要再调用任何工具。'

/**
 * 估算当前上下文的 token 构成并写入消息（归一化到该消息 usage.promptTokens）。
 * usage 缺失时跳过，避免渲染无意义的全 0 明细。
 */
const estimateAndStoreBreakdown = (
  chat: ToolChat,
  assistantMessageId: string,
  apiMessages: AiMessageParam[],
  tools: AiTool[]
): void => {
  const assistant = chat.messages.value.find((m) => m.id === assistantMessageId)
  if (!assistant || assistant.role !== 'assistant' || !assistant.usage) return
  if (!apiMessages || apiMessages.length === 0) return
  const breakdown = normalizeTokenBreakdown(
    estimateTokenBreakdown(apiMessages, tools, chat.lastSkillCatalogPrompt),
    assistant.usage.promptTokens
  )
  setAssistantTokenBreakdown(chat.messages, assistantMessageId, breakdown)
}

/** 在同一个 assistant 聊天记录中循环请求模型并执行工具。 */
const runAgentLoop = async (
  chat: ToolChat,
  params: ChatRequestParams,
  assistantMessageId: string,
  signal: AbortSignal,
  seq: number
): Promise<void> => {
  chat.status.value = 'streaming'

  let step = 0
  // 完全访问模式（mode=2）下不限制连续工具调用步数，循环只能由用户手动中断
  const maxSteps = chat.mode === 2 ? Infinity : (chat.maxSteps ?? MAX_AGENT_STEPS)
  chat.hitMaxSteps.value = false
  chat.reachedMaxSteps.value = false
  // 最近一次请求的 API 消息与工具定义（用于完成时估算 token 构成）
  let lastApiMessages: AiMessageParam[] = []
  let lastTools: AiTool[] = []
  while (seq === chat.ctx.requestSeq && !signal.aborted && step < maxSteps) {
    step++
    let functions = filterToolsByMode(chat.mode, chat.getFunctions(params))
    const resolvedParams = await chat.resolveModel(params)
    lastApiMessages = await chat.buildRequestMessages(resolvedParams, assistantMessageId)
    lastTools = buildAiTools(functions)
    const result = await streamAgentStep({
      messages: chat.messages,
      assistantMessageId,
      requestParams: resolvedParams,
      apiMessages: lastApiMessages,
      tools: lastTools,
      config: chat.ctx.config,
      signal,
      seq,
      currentSeq: () => chat.ctx.requestSeq
    })
    if (result.cancelled) return
    if (result.usage) setAssistantUsage(chat.messages, assistantMessageId, result.usage)
    if (result.toolCalls.length === 0) {
      chat.status.value = result.finishReason === 'length' ? 'stop' : 'complete'
      estimateAndStoreBreakdown(chat, assistantMessageId, lastApiMessages, lastTools)
      chat.ctx.config.onComplete?.(false, resolvedParams)
      return
    }

    chat.toolCalls.value.push(...result.toolCalls)
    // 执行前洋葱解析：③ 全局注册表兜底（含跨 Loop 自动恢复），命中即装载其集合并放行本次调用
    functions = chat.resolveForExecution(
      result.toolCalls.map((call) => call.toolCallName),
      functions
    )
    await executeToolCalls(
      chat.messages,
      assistantMessageId,
      result.toolCalls,
      functions,
      chat.buildPolicyContext(signal),
      chat.interactive
    )
    chat.toolCalls.value = [...chat.toolCalls.value]
    await nextTick()
  }

  // 超过单轮工具调用上限：
  // - finalizeOnMaxSteps（子 Agent）：执行最后一次无工具收尾调用强制输出最终总结，成功则不标记触顶
  // - 其余：主 Agent 追加提示按钮供续跑；未开启收尾的子 Agent 不追加（无继续 UI，避免污染摘要与文件）
  if (seq === chat.ctx.requestSeq && !signal.aborted && step >= maxSteps) {
    chat.reachedMaxSteps.value = true
    if (chat.finalizeOnMaxSteps) {
      const finalized = await runFinalizeStep(chat, params, assistantMessageId, signal, seq)
      if (!finalized) chat.hitMaxSteps.value = true
    } else {
      chat.hitMaxSteps.value = true
      if (!chat.isSubAgent) {
        appendAssistantContent(chat.messages, assistantMessageId, {
          type: 'text',
          data: '\n\n[已到达本轮连续工具调用上限，点击「继续推进」可让 AI 接着执行。]',
          time: Date.now(),
          // 标记提示文本：UI 渲染为可点击按钮，continueAgent 续跑前会移除
          ext: { continueHint: true }
        })
      }
      estimateAndStoreBreakdown(chat, assistantMessageId, lastApiMessages, lastTools)
    }
    chat.status.value = 'complete'
  }
}

/**
 * 触顶收尾调用：步数耗尽时执行最后一次无工具调用，注入收尾指令强制模型立即输出最终总结。
 * 指令以独立 system 消息注入（不进消息历史、不落盘），tools 置空防止模型再次调用工具。
 * 成功产出总结文本返回 true；AbortError 向上抛（走既有停止路径），其余失败返回 false 交由上层降级。
 */
const runFinalizeStep = async (
  chat: ToolChat,
  params: ChatRequestParams,
  assistantMessageId: string,
  signal: AbortSignal,
  seq: number
): Promise<boolean> => {
  const resolvedParams = await chat.resolveModel(params)
  const apiMessages = await chat.buildRequestMessages(resolvedParams, assistantMessageId)
  apiMessages.push({ role: 'system', content: FINALIZE_PROMPT })
  const before =
    chat.messages.value.find((m) => m.id === assistantMessageId)?.content?.length ?? 0
  try {
    const result = await streamAgentStep({
      messages: chat.messages,
      assistantMessageId,
      requestParams: resolvedParams,
      apiMessages,
      tools: [],
      config: chat.ctx.config,
      signal,
      seq,
      currentSeq: () => chat.ctx.requestSeq
    })
    if (result.cancelled) return false
    if (result.usage) setAssistantUsage(chat.messages, assistantMessageId, result.usage)
    estimateAndStoreBreakdown(chat, assistantMessageId, apiMessages, [])
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    return false
  }
  const content = chat.messages.value.find((m) => m.id === assistantMessageId)?.content ?? []
  return content.slice(before).some((c) => c.type === 'text' || c.type === 'markdown')
}

const handleRequestError = (chat: ToolChat, error: unknown, assistantMessageId: string): void => {
  if (error instanceof Error && error.name === 'AbortError') {
    chat.status.value = 'stop'
    chat.ctx.config.onComplete?.(true)
    setAssistantStatus(chat.messages, assistantMessageId, 'stop')
    return
  }

  // 排查用：气泡只展示 error.message 会丢堆栈，控制台补全量错误定位真实抛出点
  console.error(`[AgentChat] 请求出错 (assistantMessageId=${assistantMessageId})`, error)
  chat.status.value = 'error'
  chat.ctx.config.onError?.(error instanceof Error ? error : new Error(String(error)))
  // 异常路径同样收口：错误帧前后未走完的工具块统一定格
  chat.sweepPendingToolCalls(assistantMessageId)
  appendAssistantContent(chat.messages, assistantMessageId, {
    type: 'text',
    data: error instanceof Error ? error.message : String(error),
    time: Date.now()
  })
  setAssistantStatus(chat.messages, assistantMessageId, 'error')
}

/** 请求前置状态复位：seq 递增作废过期回调、清空渐进式装载临时态、解除挂起的交互决策 */
const beginRequest = (chat: ToolChat): { seq: number; signal: AbortSignal } => {
  chat.ctx.requestSeq += 1
  chat.ctx.abortController = new AbortController()
  chat.toolCalls.value = []
  chat.loadedCollections.value = []
  chat.interactive.clear()
  chat.status.value = 'pending'
  return { seq: chat.ctx.requestSeq, signal: chat.ctx.abortController.signal }
}

/**
 * 单轮 agent 请求执行：状态复位 → 循环请求/执行工具 → 收口收割 → 消息状态回写。
 * sendUserMessage / resume 续跑 / 继续推进共用同一入口；异常统一走 handleRequestError。
 */
export const executeAgentRequest = async (
  chat: ToolChat,
  requestParams: ChatRequestParams,
  assistantMessageId: string
): Promise<void> => {
  const { seq, signal } = beginRequest(chat)
  try {
    await runAgentLoop(chat, requestParams, assistantMessageId, signal, seq)
    // 循环收束即本轮交互结算完毕，残余非终态工具块统一定格，避免永久悬停的「等待中」
    chat.sweepPendingToolCalls(assistantMessageId)
    if (seq === chat.ctx.requestSeq && !signal.aborted) {
      const status = chat.status.value === 'idle' ? 'complete' : chat.status.value
      setAssistantStatus(chat.messages, assistantMessageId, status)
    } else if (signal.aborted) {
      // 停止：abort 落在工具执行间隙时循环正常退出（非 AbortError 抛错），需显式回写消息状态，
      // 否则消息停留在 streaming，折叠等依赖状态判断的 UI 会失效
      setAssistantStatus(chat.messages, assistantMessageId, 'stop')
    }
  } catch (error: unknown) {
    handleRequestError(chat, error, assistantMessageId)
  }
}
