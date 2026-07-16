import { BaseEntity } from '@/entity'

export type AiFriendType =
  // 职业类型，比如律师
  | 'profession'
  // 个人类型，比如朋友，不同的性格
  | 'person'
  // 其他类型
  | 'other'

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
  /**
   * 好友名字
   */
  name: string
  /**
   * 好友简介
   */
  description: string
}

export interface AiFriend extends AiFriendItem, AiFriendForm {
}

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
