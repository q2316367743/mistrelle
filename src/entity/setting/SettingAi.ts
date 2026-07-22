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
  // 输入 token 大小
  output?: number
}

export interface AiProvideCore {
  // 提供方名称
  name: string
  // 提供方基础地址
  baseUrl: string
  // 提供方密钥
  key: string

  models: Array<AiModel>
}

export interface AiProvide extends BaseEntity, AiProvideCore {}

export interface AiProvideForm extends AiProvideCore {
  id?: string
}
