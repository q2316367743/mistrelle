import type { Ref } from 'vue'
import type { ChatMessage, ToolFunction } from '@/domain'
import type { ToolCall } from './agentTypes'
import { appendSubAgentId, markToolInteractive, updateToolCallContent } from './agentMessages'
import { resolveToolPolicy, type ToolPolicyContext } from '@/modules/tool/toolPolicy'
import { MAX_TOOL_RESULT_BYTES } from '@/global/Constant'
import type { InteractiveBridge } from './interactive'
import { useSnowflake } from '@/hooks'
import {
  formatAskResult,
  normalizeAskArgs,
  type AskAnswerItem
} from '@/modules/tool/components/ask'

const ASK_TOOL_NAME = 'ask'
const SPAWN_AGENT_TOOL_NAME = 'spawn_agent'

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
  result: string,
  ext?: Record<string, unknown>
): void => {
  call.result = result
  updateToolCallContent(messages, assistantMessageId, call.toolCallId, result, ext)
}

/**
 * 从消息列表末尾向前查找最后一条 user 消息，提取模型信息。
 * 子 Agent 继承主 Agent 当前使用的模型。
 */
const findLastUserModel = (messages: Ref<ChatMessage[]>): { model: string; provide: string; reasoning_effort?: 'high' | 'max' } => {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const msg = messages.value[i]
    if (msg.role === 'user') {
      return { model: msg.model, provide: msg.provide, reasoning_effort: msg.reasoning_effort }
    }
  }
  return { model: '', provide: '' }
}

/**
 * 执行单个工具：
 * - ask：直接挂起等用户选择，选择结果作为工具结果返回（不进 policy）
 * - spawn_agent：委托子 Agent 执行只读调研任务，返回最终摘要（不进 policy）
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
    const questions = normalizeAskArgs(args)
    // 参数非法（无有效问题）时直接报错，不进入问答界面
    if (questions.length === 0) {
      applyResult(messages, assistantMessageId, call, '错误：ask 工具缺少有效的问题参数（question 或 questions）')
      return
    }
    const answer = await interactive.awaitDecision('ask', call.toolCallId, args)
    // 多问题返回答案数组；单问题或取消返回单个字符串 / null，统一按索引与问题配对
    const answers = Array.isArray(answer)
      ? answer
      : [typeof answer === 'string' ? answer : '']
    const items: AskAnswerItem[] = questions.map((q, index) => ({
      question: q.question,
      answer: (answers[index] ?? '').trim()
    }))
    applyResult(
      messages,
      assistantMessageId,
      call,
      formatAskResult(items),
      // 结构化问答对写入 ext，供 UI 结果卡片渲染「问题 → 答案」；不进模型上下文
      { askItems: items }
    )
    return
  }

  // spawn_agent：委托子 Agent 执行只读调研任务
  if (fn.name === SPAWN_AGENT_TOOL_NAME) {
    const task = typeof args.task === 'string' ? args.task : ''
    if (!task) {
      applyResult(messages, assistantMessageId, call, '错误：spawn_agent 缺少 task 参数')
      return
    }
    if (!policyContext.chatId || !policyContext.sandboxDir) {
      applyResult(messages, assistantMessageId, call, '错误：无法启动子 Agent，缺少聊天上下文')
      return
    }
    const { model, provide, reasoning_effort } = findLastUserModel(messages)
    if (!model || !provide) {
      applyResult(messages, assistantMessageId, call, '错误：无法确定子 Agent 使用的模型')
      return
    }
    // 动态导入避免循环依赖（SubAgentRunner → ToolChat → agentTools → SubAgentRunner）
    const { runSubAgent } = await import('./SubAgentRunner')
    // 预生成 subId 并立即标记到消息：使 UI 在子 Agent 运行期间即可显示标签并支持切换到其实时视图
    const subId = useSnowflake().nextId()
    appendSubAgentId(messages, assistantMessageId, subId, call.toolCallId)
    const result = await runSubAgent({
      chatId: policyContext.chatId,
      subId,
      task,
      sandboxDir: policyContext.sandboxDir,
      workspace: policyContext.workspace,
      model,
      provide,
      reasoningEffort: reasoning_effort,
      // 主 Agent 终止时级联终止子 Agent
      parentSignal: policyContext.abortSignal
    })
    applyResult(messages, assistantMessageId, call, result.summary)
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

/**
 * 并发执行一批工具调用：
 * - 同步阶段完成「查找函数 + 解析参数」，失败即时回填该工具的错误结果、不参与执行
 * - 全部工具并发执行（Promise.allSettled 等所有工具产出结果后再继续）
 * - 单个工具意外 reject 只回填它自身的错误结果，不拖垮整批、不中断循环
 * - ask/confirm 类交互决策经 InteractiveBridge 内部排队逐个等待用户作答
 */
export const executeToolCalls = async (
  messages: Ref<ChatMessage[]>,
  assistantMessageId: string,
  calls: ToolCall[],
  functions: ToolFunction[],
  policyContext: ToolPolicyContext,
  interactive: InteractiveBridge
): Promise<void> => {
  const prepared = calls.flatMap(
    (call): { call: ToolCall; fn: ToolFunction; args: Record<string, unknown> }[] => {
      const fn = functions.find((item) => item.name === call.toolCallName)
      if (!fn) {
        applyResult(messages, assistantMessageId, call, `错误: 未找到工具 "${call.toolCallName}"`)
        return []
      }
      try {
        return [{ call, fn, args: parseArguments(call.args) }]
      } catch (error: unknown) {
        applyResult(
          messages,
          assistantMessageId,
          call,
          `错误: ${error instanceof Error ? error.message : String(error)}`
        )
        return []
      }
    }
  )

  const settled = await Promise.allSettled(
    prepared.map(({ call, fn, args }) =>
      runSingleTool(messages, assistantMessageId, call, fn, args, policyContext, interactive)
    )
  )
  settled.forEach((result, index) => {
    if (result.status === 'rejected') {
      applyResult(
        messages,
        assistantMessageId,
        prepared[index].call,
        `错误: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`
      )
    }
  })
}
