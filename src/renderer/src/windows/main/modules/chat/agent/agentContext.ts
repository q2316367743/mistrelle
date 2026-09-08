import type { AiImageBlock, AiMessageParam, AiToolCallParam } from '@/windows/main/modules/ai'
import type {
  AIMessage,
  AIMessageContent,
  CanvasContent,
  ChatMessage,
  HtmlElementContent,
  SkillContent,
  TextContent,
  ToolCallContent,
  ToolContent
} from '@/domain'
import type { AssistantRequestMessage } from './agentTypes'
import {
  buildToolCallCompactPlan,
  EXPIRED_TOOL_RESULT_PLACEHOLDER,
  type ToolCallCompactPlan
} from './agentContextCompact'

// 不进入历史回传的工具调用：避免旧参数 / 旧结果污染上下文，其状态由每轮独立注入提供
const SKILL_TOOL_NAMES = new Set(['load_skill', 'read_skill_file', 'update_todo'])

const getText = (contents: AIMessageContent[]): string =>
  contents
    .filter((item) => item.type === 'text' || item.type === 'markdown')
    .map((item) => item.data)
    .join('')

const getReasoning = (contents: AIMessageContent[]): string =>
  contents
    .filter((item) => item.type === 'thinking')
    .map((item) => item.data.text ?? '')
    .join('')

const appendAssistantStep = (
  out: AiMessageParam[],
  contents: AIMessageContent[],
  filterSkillTools: boolean,
  compactPlan: ToolCallCompactPlan,
  thinking: boolean,
  /** toolCallId → image_read 等工具引用的图像块（识图模型时由调用方异步预构建） */
  imagesByToolCallId: Map<string, AiImageBlock[]> = new Map()
): void => {
  const toolContents = contents.filter(
    (item): item is ToolCallContent =>
      item.type === 'toolcall' &&
      !compactPlan.droppedToolCallIds.has(item.data.toolCallId) &&
      (!filterSkillTools || !SKILL_TOOL_NAMES.has(item.data.toolCallName))
  )
  const text = getText(contents)
  const reasoning = getReasoning(contents)
  if (!text && !reasoning && toolContents.length === 0) return

  const assistantMessage: AssistantRequestMessage = {
    role: 'assistant',
    content: text || (toolContents.length > 0 ? null : '')
  }
  // 思考模式下带 tool_calls 的 assistant 消息必须回传 reasoning_content（DeepSeek/GLM 契约，
  // 缺失返回 400 "must be passed back"），历史步无思考文本（中途开思考 / 模型空思考）时补空串
  if (reasoning || (thinking && toolContents.length > 0)) {
    assistantMessage.reasoning_content = reasoning
  }
  if (toolContents.length > 0) {
    assistantMessage.tool_calls = toolContents.map((item): AiToolCallParam => ({
      id: item.data.toolCallId,
      type: 'function',
      function: {
        name: item.data.toolCallName,
        arguments: item.data.args ?? '{}'
      }
    }))
  }
  out.push(assistantMessage)

  for (const item of toolContents) {
    out.push({
      role: 'tool',
      tool_call_id: item.data.toolCallId,
      content: compactPlan.expiredToolCallIds.has(item.data.toolCallId)
        ? EXPIRED_TOOL_RESULT_PLACEHOLDER
        : (item.data.result ?? '')
    })
  }
  appendStepVisionImages(out, toolContents, compactPlan, imagesByToolCallId)
}

/**
 * 把本步工具调用引用的图片（image_read 经 ext.visionImagePaths 落库）追加为一条
 * 紧随 tool 消息的 user 消息：role:'tool' 在各协议下只支持纯文本，图像块只能走
 * user 消息通道。紧凑化已过期调用的图片不再注入（结果已替换为占位提示）。
 */
const appendStepVisionImages = (
  out: AiMessageParam[],
  toolContents: ToolCallContent[],
  compactPlan: ToolCallCompactPlan,
  imagesByToolCallId: Map<string, AiImageBlock[]>
): void => {
  if (imagesByToolCallId.size === 0) return
  const blocks: AiImageBlock[] = []
  const paths: string[] = []
  for (const item of toolContents) {
    if (compactPlan.expiredToolCallIds.has(item.data.toolCallId)) continue
    const callBlocks = imagesByToolCallId.get(item.data.toolCallId)
    if (!callBlocks || callBlocks.length === 0) continue
    blocks.push(...callBlocks)
    const callPaths = item.ext?.visionImagePaths
    for (const path of Array.isArray(callPaths) ? callPaths : []) {
      if (typeof path === 'string' && path) paths.push(path)
    }
  }
  if (blocks.length === 0) return
  const note = paths.length > 0 ? `（对应路径：\n${paths.map((path) => `- ${path}`).join('\n')}）` : ''
  out.push({
    role: 'user',
    content: [{ type: 'text' as const, text: `[以上工具返回的图片${note}]` }, ...blocks]
  })
}

const appendAssistantMessage = (
  out: AiMessageParam[],
  message: AIMessage,
  filterSkillTools: boolean,
  compactPlan: ToolCallCompactPlan,
  thinking: boolean,
  imagesByToolCallId: Map<string, AiImageBlock[]>
): void => {
  const contents = message.content ?? []
  let step: AIMessageContent[] = []
  let stepId: string | undefined

  const flush = () => {
    appendAssistantStep(out, step, filterSkillTools, compactPlan, thinking, imagesByToolCallId)
    step = []
    stepId = undefined
  }

  for (const content of contents) {
    if (content.stepId) {
      if (step.length > 0 && stepId !== content.stepId) flush()
      stepId = content.stepId
      step.push(content)
      continue
    }

    // 旧记录没有 stepId：工具后的非工具内容视为下一次模型响应。
    if (step.some((item) => item.type === 'toolcall') && content.type !== 'toolcall') flush()
    step.push(content)
    if (content.type === 'toolcall') stepId = undefined
  }
  flush()
}

/**
 * 把用户消息中显式指定的 Skill / 工具渲染成给模型的指令文本。
 * 仅识别结构化的 SkillContent / ToolContent（UI 输入框引用产生），不做文本解析与兼容。
 * 返回空串表示该消息无显式指定；调用方只把它拼到当前用户消息上，不进入 system 前缀。
 */
const buildPinnedContext = (msg: ChatMessage): string => {
  if (msg.role !== 'user') return ''
  const skills = msg.content.filter((c): c is SkillContent => c.type === 'skill')
  const tools = msg.content.filter((c): c is ToolContent => c.type === 'tool')
  const canvases = msg.content.filter((c): c is CanvasContent => c.type === 'canvas')
  const htmlElements = msg.content.filter((c): c is HtmlElementContent => c.type === 'html-element')
  if (
    skills.length === 0 &&
    tools.length === 0 &&
    canvases.length === 0 &&
    htmlElements.length === 0
  )
    return ''

  const parts: string[] = []
  if (skills.length > 0) {
    const list = skills
      .map(
        (s) =>
          `- Skill「${s.data.name}」：请调用 load_skill("${s.data.name}") 加载完整指令并严格遵循`
      )
      .join('\n')
    parts.push(`用户在本条消息中指定了以下 Skill，请直接加载并遵循（无需再确认）：\n${list}`)
  }
  if (tools.length > 0) {
    const list = tools
      .map(
        (t) => `- 工具「${t.data.label}」（调用名 ${t.data.name}）：请直接调用 ${t.data.name} 执行`
      )
      .join('\n')
    parts.push(`用户在本条消息中指定了以下工具，请直接调用（无需再确认）：\n${list}`)
  }
  if (canvases.length > 0) {
    const list = canvases
      .map(
        (c) =>
          `- 画布节点：画布 canvas-${c.data.version} 中的节点 ${c.data.nodeId}（图层名 ${c.data.label ?? c.data.nodeId}）：请先 canvas_open(${c.data.version}) 打开画布，再用 canvas_get_nodes / canvas_batch_edit 等工具定位并处理该节点`
      )
      .join('\n')
    parts.push(`用户在本条消息中指定了以下画布节点，请先打开画布定位节点，再按需修改：\n${list}`)
  }
  if (htmlElements.length > 0) {
    const list = htmlElements
      .map(
        (e) =>
          `- 设计稿元素：html-${e.data.version} 中的元素 ${e.data.label}（DOM 路径 ${e.data.path}）：请按描述链特征（标签 / 类名 / 文本）在源码中定位该元素并按用户要求修改；用 html_write 整页重写提交，除该元素相关部分外其余保持不变`
      )
      .join('\n')
    parts.push(
      `用户在本条消息中选中了以下 HTML 设计稿元素（在预览中点选产生），请定位并修改：\n${list}`
    )
  }
  return parts.join('\n\n')
}

export const toAgentRequestMessages = (
  messages: ChatMessage[],
  activeAssistantMessageId: string,
  activeReferenceContext = '',
  /** 消息 id → 图像内容块（识图模型时由调用方异步预构建，全部历史保留） */
  imagesByMessageId: Map<string, AiImageBlock[]> = new Map(),
  /** 本次请求思考模式是否开启（未显式关闭视为开启，与服务端默认一致） */
  thinking = true,
  /** toolCallId → 工具引用图像块（image_read，识图模型时由调用方异步预构建） */
  imagesByToolCallId: Map<string, AiImageBlock[]> = new Map()
): AiMessageParam[] => {
  const out: AiMessageParam[] = []
  const activeAssistantIndex = messages.findIndex(
    (message) => message.id === activeAssistantMessageId
  )
  const activeUserIndex = activeAssistantIndex > 0 ? activeAssistantIndex - 1 : -1
  const compactPlan = buildToolCallCompactPlan(messages, activeAssistantMessageId)

  for (const [index, message] of messages.entries()) {
    if (message.role === 'user') {
      const content = message.content
        .filter((item): item is TextContent => item.type === 'text')
        .map((item) => item.data)
        .join('')
      let extra = ''
      if (index === activeUserIndex) {
        // 当前用户消息：引用文件上下文 + 显式指定的 skill/工具 指令，二者都不进 system 前缀
        const ref = activeReferenceContext.replace(/^\n+/, '')
        const pinned = buildPinnedContext(message)
        extra = [ref, pinned].filter(Boolean).join('\n\n')
      }
      const textBody = extra ? `${content}\n\n${extra}` : content
      const images = imagesByMessageId.get(message.id)
      if (images && images.length > 0) {
        // 识图：文本与图像块同序输出，图片仅允许出现在 user 消息中（DeepSeek 等视觉 API 约束）
        out.push({
          role: 'user',
          content: [...(textBody ? [{ type: 'text' as const, text: textBody }] : []), ...images]
        })
      } else {
        out.push({ role: 'user', content: textBody })
      }
      continue
    }

    if (message.role === 'system') {
      out.push({
        role: 'system',
        content: message.content
          .filter((item): item is TextContent => item.type === 'text')
          .map((item) => item.data)
          .join('')
      })
      continue
    }

    appendAssistantMessage(
      out,
      message,
      message.id !== activeAssistantMessageId,
      compactPlan,
      thinking,
      imagesByToolCallId
    )
  }

  return out
}
