import { BaseEntity } from '@/entity'

export interface AiGroup extends BaseEntity {
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

  /**
   * 默认使用的模型
   */
  defaultModel: string

  /**
   * 是否置顶
   */
  top: boolean
}
