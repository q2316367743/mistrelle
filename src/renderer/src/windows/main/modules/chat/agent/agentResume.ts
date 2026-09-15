import type { ChatRequestParams } from '@/windows/main/modules/chat'
import { toolPhaseOf, updateToolCallContent } from './agentMessages'
import { findPendingInteractiveToolcall } from './interactive'
import { filterToolsByMode } from './agentFunctions'
import { parseArguments, runSingleTool } from './agentTools'
import { executeAgentRequest } from './agentLoop'
import type { AgentRuntime } from './runtime'

/**
 * 收口收割：把悬停在非终态的工具块推进到正确状态。
 * - 已有结果却未标完成（持久化快照竞态 / 历史脏数据）→ 补 complete
 * - 无结果的漏网块（非交互）→ stop + 「本轮已停止，工具未执行」
 * - confirm 相（等待用户决策）保留——它们是 resume 恢复审批的合法素材，
 *   收割会跳过，不误杀跨重启的真挂起
 */
export const sweepPendingToolCalls = (runtime: AgentRuntime, assistantMessageId?: string): void => {
  const targets = assistantMessageId
    ? runtime.messages.value.filter((message) => message.id === assistantMessageId)
    : runtime.messages.value
  for (const message of targets) {
    if (message.role !== 'assistant') continue
    for (const content of message.content ?? []) {
      if (content.type !== 'toolcall') continue
      const phase = toolPhaseOf(content)
      if (phase === 'complete' || phase === 'stop') continue
      if (content.data.result) {
        content.status = 'complete'
        continue
      }
      if (phase === 'confirm') continue
      content.status = 'stop'
      content.data.result = '本轮已停止，工具未执行'
    }
  }
}

/**
 * 根据存储的 assistant 消息重建恢复请求参数：模型信息来自 assistant 消息，
 * 用户内容取它前一条 user 消息，供 resume 续跑同一轮使用。
 */
const buildResumeRequestParams = (
  runtime: AgentRuntime,
  target: { assistantMessageId: string }
): ChatRequestParams => {
  const messages = runtime.messages.value
  const index = messages.findIndex((m) => m.id === target.assistantMessageId)
  const assistant = messages[index]
  const prev = index > 0 ? messages[index - 1] : undefined
  const userMessage = prev?.role === 'user' ? prev : undefined
  return {
    message: {
      content: userMessage?.content ?? [],
      model: assistant?.role === 'assistant' ? assistant.model : '',
      provide: assistant?.role === 'assistant' ? assistant.provide : '',
      thinking: userMessage?.thinking,
      reasoning_effort: userMessage?.reasoning_effort
    },
    mode: assistant?.role === 'assistant' ? assistant.mode : runtime.mode,
    agentId: assistant?.role === 'assistant' ? assistant.agentId : undefined,
    workspace: runtime.workspace
  }
}

/**
 * 应用重启后恢复上次挂起的 ask / confirm 决策。
 * 挂起状态隐式落在持久化消息中（toolcall confirm 相 + ext.interactive），
 * 这里重新挂起等用户作答，作答后复用同一条 assistant 消息续跑同一轮。
 */
export const resumePendingInteractives = async (runtime: AgentRuntime): Promise<void> => {
  if (!runtime.canStartRequest()) return
  const target = findPendingInteractiveToolcall(runtime.messages.value)
  if (!target) return
  const { assistantMessageId, call } = target
  const params = buildResumeRequestParams(runtime, target)
  const baseFunctions = filterToolsByMode(runtime.mode, runtime.getFunctions(params))
  // 重启恢复同样走洋葱解析兜底，避免挂起中的集合工具因未装载而「未找到」
  const functions = runtime.resolveForExecution([call.toolCallName], baseFunctions)
  const fn = functions.find((item) => item.name === call.toolCallName)
  if (fn) {
    let args: Record<string, unknown>
    try {
      args = parseArguments(call.args)
    } catch {
      args = {}
    }
    await runSingleTool(
      runtime.messages,
      assistantMessageId,
      call,
      fn,
      args,
      runtime.buildPolicyContext(runtime.ctx.abortController?.signal),
      runtime.interactive
    )
  } else {
    updateToolCallContent(
      runtime.messages,
      assistantMessageId,
      call.toolCallId,
      `错误: 未找到工具 "${call.toolCallName}"`
    )
  }
  // 作答期间若用户已另发起新请求，放弃续跑，避免并发循环
  if (!runtime.canStartRequest()) return
  await executeAgentRequest(runtime, params, assistantMessageId)
}

/** 移除 assistant 消息中的「继续推进」提示文本 */
const removeContinueHint = (runtime: AgentRuntime, assistantMessageId: string): void => {
  const message = runtime.messages.value.find((item) => item.id === assistantMessageId)
  if (!message || message.role !== 'assistant' || !message.content) return
  const before = message.content.length
  message.content = message.content.filter(
    (item) => !(item.type === 'text' && item.ext?.continueHint === true)
  )
  if (message.content.length !== before) {
    runtime.messages.value = [...runtime.messages.value]
  }
}

/**
 * 连续工具调用达到上限后，点击提示按钮继续推进同一轮。
 * 先移除提示文本（避免残留进模型上下文），再复用同一条 assistant 消息续跑，
 * 模型拿到历史 tool 结果后继续执行，步数计数重新开始。
 */
export const continueAgentRun = async (runtime: AgentRuntime, assistantMessageId: string): Promise<void> => {
  if (!runtime.canStartRequest()) return
  removeContinueHint(runtime, assistantMessageId)
  const params = buildResumeRequestParams(runtime, { assistantMessageId })
  await executeAgentRequest(runtime, params, assistantMessageId)
}
