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
import { resolveScene } from '@/windows/main/modules/chat/scenes'
import { hasImageGenerateAccess } from '@/windows/main/modules/tool/components/design/imageGenerate'
import {
  DESIGN_DRAW_TOOL_NAME,
  resolveDesignDrawSize
} from '@/windows/main/modules/tool/components/canvas/designDraw'

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

/**
 * image_read → 请求图片注入约定：handler 返回对象含 visionImages（路径数组）时，
 * 路径经 ext 落到工具调用块上，请求构建时读盘重建为图像块、以「紧随 tool 消息的
 * user 消息」注入模型上下文（工具结果消息本身不支持图像块），并从回传给模型的
 * 结果中剥离该标记。
 */
const extractVisionImagePaths = (raw: unknown): { rest: unknown; paths?: string[] } => {
  if (!raw || typeof raw !== 'object') return { rest: raw }
  const images = (raw as { visionImages?: unknown }).visionImages
  if (!Array.isArray(images)) return { rest: raw }
  const paths = images.filter((item): item is string => typeof item === 'string' && !!item)
  const rest = { ...(raw as Record<string, unknown>) }
  delete rest.visionImages
  return paths.length > 0 ? { rest, paths } : { rest }
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

  // spawn_agent：委托子 Agent 执行独立任务（调研 / 生图），返回最终摘要（不进 policy）
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
    // 解析并校验子 Agent 类型（按场景能力矩阵，如短篇小说场景仅允许 research）
    const resolved = resolveSubAgentType(
      args.type,
      resolveScene(
        policyContext.chatType ?? 'office',
        policyContext.writingScene,
        policyContext.designScene
      ).subAgentAllow
    )
    if (!resolved.ok) {
      applyResult(messages, assistantMessageId, call, `错误: spawn_agent ${resolved.message}`)
      return
    }
    // 生图型子 Agent 的能力面全部依赖服务端生图（登录门控）：未登录直接拒绝，
    // 避免起一个无可用工具的空子 Agent 白耗步数
    if (resolved.type === 'image' && !hasImageGenerateAccess()) {
      applyResult(
        messages,
        assistantMessageId,
        call,
        '错误: 生图型子 Agent 需要登录后使用（生图由服务端提供，请先登录）'
      )
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

  // design_draw：以内嵌画布 agent 绘图并导出 PNG（不进 policy；prompt 可读、path 由外层策略把关）
  if (fn.name === DESIGN_DRAW_TOOL_NAME) {
    const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : ''
    if (!prompt) {
      applyResult(messages, assistantMessageId, call, '错误：design_draw 缺少 prompt 参数')
      return
    }
    if (!policyContext.chatId || !policyContext.sandboxDir) {
      applyResult(messages, assistantMessageId, call, '错误：无法开始绘制，缺少聊天上下文')
      return
    }
    const { model, provide, thinking, reasoning_effort } = findLastUserModel(messages)
    if (!model || !provide) {
      applyResult(messages, assistantMessageId, call, '错误：无法确定绘图使用的模型')
      return
    }
    const size = resolveDesignDrawSize(args.size)
    const pathArg = typeof args.path === 'string' && args.path.trim() ? args.path.trim() : ''
    const outputPath =
      pathArg ||
      window.preload.path.join(
        policyContext.sandboxDir,
        'outputs',
        'images',
        `design-${Date.now()}.png`
      )
    markToolExecuting(messages, assistantMessageId, call.toolCallId)
    // 动态导入避免循环依赖（designDraw → AgentChat → agentFunctions → ChatTypeConfig → designDraw）
    const { runDesignDraw } = await import(
      '@/windows/main/modules/tool/components/canvas/designDraw'
    )
    try {
      const result = await runDesignDraw({
        prompt,
        size,
        outputPath,
        sandboxDir: policyContext.sandboxDir,
        workspace: policyContext.workspace,
        model,
        provide,
        thinking,
        reasoningEffort: reasoning_effort,
        // 主 Agent 终止时级联终止内部绘制
        parentSignal: policyContext.abortSignal
      })
      // chatImages：执行器据此把图片作为 image 块展示在对话中，并从回传模型的结果里剥离该标记
      applyResult(
        messages,
        assistantMessageId,
        call,
        serializeResult({
          success: true,
          path: result.path,
          width: result.width,
          height: result.height,
          size: `${size.width}x${size.height}`,
          note: '设计图已生成并展示在对话中（画布方式绘制，可精确控制文案与版式）',
          chatImages: [
            {
              path: result.path,
              name: window.preload.path.basename(result.path),
              width: result.width,
              height: result.height
            }
          ]
        })
      )
    } catch (error: unknown) {
      applyResult(
        messages,
        assistantMessageId,
        call,
        error instanceof Error ? `错误: ${error.message}` : '错误: 绘制失败'
      )
    }
    return
  }

  const verdict = resolveToolPolicy(fn, args, policyContext)
  if (verdict === 'deny') {
    applyResult(messages, assistantMessageId, call, '该操作被安全策略拦截')
    return
  }
  if (verdict === 'ask') {
    // 无审批通道（子 Agent）：需审批的调用直接以「自动拒绝」收场，不进交互桥等待。
    // 文案与「用户拒绝」区分：这是能力面限制，不是用户否决
    if (policyContext.denyOnAsk) {
      applyResult(
        messages,
        assistantMessageId,
        call,
        '该操作需要用户审批，本会话无审批通道，已自动拒绝；请改用允许范围内的方式完成任务'
      )
      return
    }
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
    // visionImages 约定（image_read）：路径落 ext 供请求构建注入图像块，模型可见文本剥离标记
    const { rest, paths } = extractVisionImagePaths(output)
    applyResult(
      messages,
      assistantMessageId,
      call,
      serializeResult(rest),
      paths ? { visionImagePaths: paths } : undefined
    )
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
