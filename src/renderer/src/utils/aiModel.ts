import type { TagProps } from 'tdesign-vue-next'
import { AiModelTypeOptions, type AiModelType } from '@/entity'
import {
  FAMILY_PARAMS_RULES,
  MODEL_PARAMS_TABLE,
  type AiModelParams
} from '@/global/aiModelPresets'

export type { AiModelParams }

const TYPE_RULES: Array<[RegExp, Exclude<AiModelType, 'chat'>]> = [
  [/tts|speech|voice|audio/, 'voice'],
  [/image|img|dall-?e|dalle|flux|sdxl|stable-diffusion|midjourney/, 'image'],
  [/video|veo|sora|kling|gen-[234]|runway|pika/, 'video'],
  [/embedding|embed|vector|rerank|bge/, 'vector']
]

/** 根据模型 ID 猜测模型类型，匹配不到视为聊天类型 */
export function guessModelType(id: string): AiModelType {
  const lower = id.toLowerCase()
  for (const [re, type] of TYPE_RULES) {
    if (re.test(lower)) return type
  }
  return 'chat'
}

export const MODEL_TYPE_LABEL = Object.fromEntries(
  AiModelTypeOptions.map((o) => [o.value, o.label])
) as Record<AiModelType, string>

export const MODEL_TYPE_THEME: Partial<Record<AiModelType, TagProps['theme']>> = {
  image: 'warning',
  video: 'danger',
  voice: 'success',
  vector: 'primary'
}

/**
 * 根据模型 ID 猜测上下文窗口与最大输出大小（token）：
 * 先查精确表（MODEL_PARAMS_TABLE），未命中再按家族正则兜底（FAMILY_PARAMS_RULES），
 * 两者皆未命中返回空对象。规则维护见 src/global/aiModelPresets.ts。
 */
export function guessModelParams(id: string): AiModelParams {
  const key = id.toLowerCase().trim()
  const exact = MODEL_PARAMS_TABLE[key]
  if (exact) return { ...exact }
  for (const [re, params] of FAMILY_PARAMS_RULES) {
    if (re.test(key)) return { ...params }
  }
  return {}
}

/** 将 token 数格式化为可读文本：128000 → 128K、1048576 → 1M；无值时返回空串 */
export function formatContextWindow(n?: number): string {
  if (!n || n <= 0) return ''
  if (n >= 1_000_000) return `${trimNumber(n / 1_000_000)}M`
  if (n >= 1_000) return `${trimNumber(n / 1_000)}K`
  return String(n)
}

function trimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')
}
