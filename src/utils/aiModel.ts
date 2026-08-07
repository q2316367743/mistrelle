import type { TagProps } from 'tdesign-vue-next'
import { AiModelTypeOptions, type AiModelType } from '@/entity'

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
