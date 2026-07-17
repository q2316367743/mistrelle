import { BaseEntity } from '@/entity'
import { CommonSelect } from '@/domain'

export type AiFriendType =
  // 职业类型，比如律师
  | 'profession'
  // 伙伴类型，比如朋友、知己
  | 'companion'
  // 名人类型，比如历史人物、虚构角色
  | 'celebrity'
  // 其他类型
  | 'other'
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

export const typeOptions: Array<CommonSelect<AiFriendType>> = [
  { label: '职业', value: 'profession' },
  { label: '伙伴', value: 'companion' },
  { label: '名人', value: 'celebrity' },
  { label: '其他', value: 'other' },

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

export interface AiFriendForm {
  type: AiFriendType

  // ------------------------------- 基础 -------------------------------

  /**
   * 好友名字
   */
  name: string
  /**
   * 好友简介
   */
  description: string

  /**
   * 好友提示词
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

export interface AiFriendItem extends BaseEntity {
  type: AiFriendType
  /**
   * 好友名字
   */
  name: string
  /**
   * 好友简介
   */
  description: string
}

export interface AiFriend extends AiFriendItem, AiFriendForm {}

export const buildAiFriendForm = (): AiFriendForm => {
  return {
    type: 'other',
    name: '',
    description: '',
    prompt: '',
    tools: [],
    model: '',
    placeholder: '',
    think: false
  }
}
