/**
 * 写作场景配图「AI 代写生图描述」：把作品语境交给一个快速模型，产出一段可直接生图的英文画面描述。
 *
 * 为什么需要：用户在写文章 / 小说时手写提示词门槛高（要懂英文生图描述写法、还要自行提炼画面）。
 * 这里在弹窗打开时用作品自身的标题 / 摘要 / 提纲（插图另加选中的正文片段）代写一版，
 * 用户可直接用、可修改、可「换一版」——保留人工可控，但把最费劲的一步自动化。
 *
 * 走 createChatCompletion（非流式聚合）+ 设置里的快速模型，与聊天命名同款轻量一次性调用范式；
 * 无可用模型时返回空串，弹窗静默退回手写（不打断流程、不报错）。
 */
import { createChatCompletion } from '@/windows/main/modules/ai'
import { useSettingAiStore, useSettingDefaultStore } from '@/windows/main/store'

/** 生图用途：封面（横版）或正文插图（方形），决定尺寸口径与提示词侧重 */
export type ImagePromptKind = 'cover' | 'image'

/** 弹窗可用的作品语境（缺省字段不注入提示词） */
export interface ImagePromptContext {
  /** 作品标题 */
  title?: string
  /** 一句话摘要 / 选题 */
  summary?: string
  /** 提纲 */
  outline?: string
  /**
   * 用户选中的正文片段——插图生图的**核心依据**（画什么由它决定）。
   * 不设「正文全文」兜底字段：传全文会让模型画成泛泛的全文配图而非这一段，
   * 且没有选中就无从确定图插到哪，工具栏已据此禁用生图。
   */
  selection?: string
}

/** 单个语境字段的注入上限（防超长正文把提示词撑爆；按字符截断） */
const MAX_FIELD_CHARS = 1200

const clip = (value: string | undefined): string => {
  const text = value?.trim()
  if (!text) return ''
  return text.length > MAX_FIELD_CHARS ? `${text.slice(0, MAX_FIELD_CHARS)}…` : text
}

/** 组装用户消息：按 kind 决定强调封面还是段落插图 */
const buildUserMessage = (kind: ImagePromptKind, context: ImagePromptContext): string => {
  const lines: string[] = [`配图用途：${kind === 'cover' ? '作品封面（横版 16:9）' : '正文插图（方形 1:1）'}`]
  const title = clip(context.title)
  const summary = clip(context.summary)
  const outline = clip(context.outline)
  const selection = clip(context.selection)
  if (title) lines.push(`作品标题：${title}`)
  if (summary) lines.push(`选题摘要：${summary}`)
  // 插图：选中片段优先且置于最前，让模型以它为主而非被提纲带偏
  if (selection) lines.push(`需要配图的正文片段（画面的主体内容以此为准）：\n${selection}`)
  if (outline) lines.push(`作品提纲（仅供理解上下文，不要照提纲画全景）：\n${outline}`)
  return lines.join('\n\n')
}

const SYSTEM_PROMPT = [
  '你是资深 AI 绘画提示词工程师。根据给出的作品语境，写一段用于文生图模型的画面描述。',
  '',
  '要求：',
  '- 只输出一段英文画面描述，不要解释、不要标题、不要引号、不要换行列表',
  '- 覆盖：主体内容、视觉风格、配色、构图、光照 / 氛围',
  '- 封面：横版构图，突出作品主题的核心意象，留出可承载标题文案的负空间',
  '- 插图：方形构图，**画面主体严格取自「需要配图的正文片段」**，把它转成具体的视觉意象；标题 / 提纲只用来理解背景，不要画成全景式或封面式大图',
  '- 画面中不要出现任何文字、字母、数字或水印（文字由后期排版叠加）',
  '- 风格保持现代、克制、有质感，避免俗套的霓虹渐变与廉价 3D'
].join('\n')

/**
 * 起草一段生图描述。
 * @returns 英文画面描述；无可用模型或调用失败时返回空串（调用方静默退回手写）
 */
export const draftImagePrompt = async (
  kind: ImagePromptKind,
  context: ImagePromptContext
): Promise<string> => {
  const { defaultQuickModel, defaultAssistantModel } = useSettingDefaultStore().state
  const modelKey = defaultQuickModel || defaultAssistantModel
  if (!modelKey) return ''
  const option = useSettingAiStore().optionMap.get(modelKey)
  if (!option) return ''

  try {
    const result = await createChatCompletion({
      baseURL: option.baseUrl,
      apiKey: option.key,
      format: option.format ?? 'chat',
      model: option.model,
      builtin: option.builtin,
      // 起草无需思考：显式关闭，避免思考型模型输出长思考污染描述
      thinking: false,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserMessage(kind, context) }
      ]
    })
    // 多行输出（模型偶尔仍分行）压成一行，便于用户在单行描述里继续编辑
    return result.content.replace(/\s*\n+\s*/g, ' ').trim()
  } catch (error) {
    console.error('[writing-image] 生图描述起草失败', error)
    return ''
  }
}
