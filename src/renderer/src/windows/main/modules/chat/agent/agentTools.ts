import type { Ref } from 'vue'
import type { ChatMessage, ToolFunction } from '@/domain'
import type { ToolCall } from './agentTypes'
import {
  appendAssistantContent,
  appendSubAgentId,
  markToolExecuting,
  markToolInteractive,
  updateToolCallContent
} from './agentMessages'
import { resolveToolPolicy, type ToolPolicyContext } from '@/windows/main/modules/tool/toolPolicy'
import { MAX_TOOL_RESULT_BYTES } from '@/global/Constant'
import type { InteractiveBridge } from './interactive'
import { isConfirmDecision } from './interactive'
import { useSnowflake } from '@/hooks'
import {
  formatAskResult,
  normalizeAskArgs,
  type AskAnswerItem
} from '@/windows/main/modules/tool/components/ask'
import { FONT_PICK_TOOL_NAME, formatFontPickResult } from '@/windows/main/modules/tool/components/design/fontTools'
import { SPAWN_AGENT_TOOL_NAME } from '@/windows/main/modules/subagent/tool'
import { resolveSubAgentType } from '@/windows/main/modules/subagent/types'

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

/**
 * 工具 → 对话图片块约定：handler 返回对象含 chatImages 数组时，逐项落为 image 内容块
 * 直接展示在对话中（纯 UI 块，不进模型上下文），并从回传给模型的结果中剥离该标记。
 * image 块复用工具调用块的 stepId，与工具调用归属同一响应步骤。
 */
const appendChatImages = (
  messages: Ref<ChatMessage[]>,
  assistantMessageId: string,
  call: ToolCall,
  raw: unknown
): unknown => {
  if (!raw || typeof raw !== 'object') return raw
  const images = (raw as { chatImages?: unknown }).chatImages
  if (!Array.isArray(images) || images.length === 0) return raw

  const assistant = messages.value.find((m) => m.id === assistantMessageId)
  const stepId =
    assistant?.role === 'assistant'
      ? assistant.content?.findLast(
          (item) => item.type === 'toolcall' && item.data.toolCallId === call.toolCallId
        )?.stepId
      : undefined

  for (const item of images) {
    if (!item || typeof item !== 'object') continue
    const { path, name, width, height } = item as {
      path?: unknown
      name?: unknown
      width?: unknown
      height?: unknown
    }
    if (typeof path !== 'string' || !path) continue
    appendAssistantContent(messages, assistantMessageId, {
      type: 'image',
      ...(stepId ? { stepId } : {}),
      data: {
        ...(typeof name === 'string' && name ? { name } : {}),
        url: path,
        ...(typeof width === 'number' ? { width } : {}),
        ...(typeof height === 'number' ? { height } : {})
      },
      time: Date.now()
    })
  }

  const rest = { ...(raw as Record<string, unknown>) }
  delete rest.chatImages
  return rest
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
const findLastUserModel = (messages: Ref<ChatMessage[]>): {
  model: string
  provide: string
  thinking?: boolean
  reasoning_effort?: 'low' | 'high' | 'max'
} => {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const msg = messages.value[i]
    if (msg.role === 'user') {
      return {
        model: msg.model,
        provide: msg.provide,
        thinking: msg.thinking,
        reasoning_effort: msg.reasoning_effort
      }
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

  // font_pick：弹出选字面板让用户挑字体，选择的字体名作为工具结果返回（不进 policy）
  if (fn.name === FONT_PICK_TOOL_NAME) {
    markToolInteractive(messages, assistantMessageId, call.toolCallId, 'font_pick')
    const decision = await interactive.awaitDecision('font_pick', call.toolCallId, args)
    const picked = typeof decision === 'string' && decision.trim() ? decision.trim() : null
    applyResult(messages, assistantMessageId, call, formatFontPickResult(picked), {
      pickedFont: picked ?? undefined
    })
    return
  }

  // spawn_agent：委托子 Agent 执行独立任务（调研 / 设计），返回最终摘要（不进 policy）
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
    // 解析并校验子 Agent 类型（按当前聊天类型能力矩阵 SUB_AGENT_ALLOW，缺省 research）
    const resolved = resolveSubAgentType(args.type, policyContext.chatType ?? 'office')
    if (!resolved.ok) {
      applyResult(messages, assistantMessageId, call, `错误: spawn_agent ${resolved.message}`)
      return
    }
    const { model, provide, thinking, reasoning_effort } = findLastUserModel(messages)
    if (!model || !provide) {
      applyResult(messages, assistantMessageId, call, '错误：无法确定子 Agent 使用的模型')
      return
    }
    markToolExecuting(messages, assistantMessageId, call.toolCallId)
    // 动态导入避免循环依赖（subagent/runner → AgentChat → agentTools → subagent/runner）
    const { runSubAgent } = await import('@/windows/main/modules/subagent')
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
      thinking,
      reasoningEffort: reasoning_effort,
      subAgentType: resolved.type,
      // 隐私聊天：子 Agent 继承标记（同样不注册记忆工具）
      privacy: policyContext.privacy,
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
    const decision = await interactive.awaitDecision('confirm', call.toolCallId, args)
    const approved = decision === true || (isConfirmDecision(decision) && decision.approved)
    if (!approved) {
      // null：挂起决策被中止清空（停止操作 / 新请求抢占 / 子 Agent 无交互桥），并非用户拒绝；
      // false 或 { approved: false }：用户明确点了「拒绝」。两者文案必须区分，否则停止会被误读为拒绝
      applyResult(
        messages,
        assistantMessageId,
        call,
        decision === null ? '本轮已停止，工具未执行' : '用户拒绝了该工具调用'
      )
      return
    }
    // 用户勾选「此目录以后都允许」：把目录写入聊天白名单（仅主 Agent 提供回调，子 Agent 保持只读）
    if (isConfirmDecision(decision) && decision.allowDir) {
      policyContext.onAllowDir?.(decision.allowDir)
    }
  }

  // verdict=allow 直通 / 审批通过后的真实执行期：进入「执行中」态
  markToolExecuting(messages, assistantMessageId, call.toolCallId)

  try {
    const raw = await fn.handler(args)
    // chatImages 约定：图片块入对话展示后剥离标记，模型只看到业务字段
    const output = appendChatImages(messages, assistantMessageId, call, raw)
    applyResult(messages, assistantMessageId, call, serializeResult(output))
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
