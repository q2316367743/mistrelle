import { BaseEntity } from '@/entity'
import { CommonSelect } from '@/domain'

export type AiPromptType =
  | 'office'
  | 'content'
  | 'development'
  | 'data_analysis'
  | 'design_media'
  | 'agent'
  | 'knowledge'
  | 'business'
  | 'education'
  | 'professional'
  | 'it_ops'
  | 'lifestyle'

export const typeOptions: Array<CommonSelect<AiPromptType>> = [
  { label: '办公效率', value: 'office' },
  { label: '内容创作', value: 'content' },
  { label: '开发编程', value: 'development' },
  { label: '数据分析', value: 'data_analysis' },
  { label: '设计多媒体', value: 'design_media' },
  { label: 'AI Agent', value: 'agent' },
  { label: '知识管理', value: 'knowledge' },
  { label: '商业运营', value: 'business' },
  { label: '教育学习', value: 'education' },
  { label: '行业专业', value: 'professional' },
  { label: 'IT 运维与安全', value: 'it_ops' },
  { label: '生活服务', value: 'lifestyle' }
]

export interface AiPromptForm {
  type: AiPromptType

  // ------------------------------- 基础 -------------------------------

  /**
   * 提示词名字
   */
  name: string
  /**
   * 提示词简介
   */
  description: string

  /**
   * 提示词
   */
  prompt: string

  /**
   * 启用的工具
   */
  tools: Array<string>

  // ------------------------------- 高级 -------------------------------

  /**
   * 默认使用的模型
   */
  model: string

  /**
   * 输入框占位符
   */
  placeholder: string

  /**
   * 是否深度思考
   */
  think: boolean
}

export interface AiPromptItem extends BaseEntity {
  type: AiPromptType
  /**
   * 提示词名字
   */
  name: string
  /**
   * 提示词简介
   */
  description: string
}

/**
 * AI 提示词管理
 */
export interface AiPrompt extends AiPromptItem, AiPromptForm {}

export const buildAiPromptForm = (): AiPromptForm => {
  return {
    type: 'office',
    name: '',
    description: '',
    prompt: '',
    tools: [],
    model: '',
    placeholder: '',
    think: false
  }
}
