import { BaseEntity } from '@/entity'

export interface AiGroupForm {
  // ------------------------------- 基础 -------------------------------

  /**
   * 分组名字
   */
  name: string

  /**
   * 分组提示词
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

export interface AiGroup extends BaseEntity, AiGroupForm {

  // ------------------------------- 状态 -------------------------------

  /**
   * 是否置顶
   */
  top: boolean
}


export const buildAiGroupForm = (): AiGroupForm => {
  return {
    name: '',
    prompt: '',
    tools: [],
    model: '',
    placeholder: '',
    think: false
  }
}
