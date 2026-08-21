import { BaseEntity } from '@/entity'
import { CommonSelect } from '@/domain'

export type AiModelType = 'chat' | 'image' | 'video' | 'voice' | 'vector'

export const AiModelTypeOptions: Array<CommonSelect> = [
  { value: 'chat', label: '聊天' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'voice', label: '语音' },
  { value: 'vector', label: '向量' }
]

/** 模型能力位（独立 type，后续新增能力只扩展此处） */
export type AiModelSupport = 'image' | 'think'

export const AiModelSupportOptions: Array<CommonSelect> = [
  { value: 'image', label: '识图' }
]

export interface AiModel {
  // 标识符
  identifier: string
  // 模型
  model: string
  // 是否启用
  enable: boolean
  // 模型类型：聊天/图片/视频/语音/向量
  type: AiModelType
  // 总上下文大小
  context?: number
  // 最大输出 token 大小
  output?: number
  // 支持的能力（勾选识图后聊天引用的图片会随请求传递）
  support?: AiModelSupport[]
}

/**
 * - anthropic: Anthropic Message (/v1/messages)
 * - chat: Chat Completions (/chat/completions)
 * - responses: Responses (/responses)
 */
export type AiProvideFormat = 'anthropic' | 'chat' | 'responses'

export interface AiProvideCore {
  // 提供方名称
  name: string
  // 提供方基础地址
  baseUrl: string
  // 提供方密钥
  key: string

  models: Array<AiModel>

  /**
   * 是否启用该提供方。关闭后其模型不出现在选择列表中。
   * @default true
   */
  enable: boolean

  /**
   * API 格式
   * 默认 Chat Completions
   * @default 'chat'
   */
  format?: AiProvideFormat
}

/**
 * ~/.mistrelle/model.json
 */
export interface AiProvide extends BaseEntity, AiProvideCore {}

export interface AiProvideForm extends AiProvideCore {
  id?: string
}
