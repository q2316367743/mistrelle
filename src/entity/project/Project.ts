import { BaseEntity } from '@/entity'

export interface Project extends BaseEntity {
  name: string

  /**
   * ## 指令
   * 提供当前项目的背景信息和规范，让助手的回复更加准确，更符合要求，比如项目目标、团队习惯、风格偏好、输出约束等。
   */
  prompt: string

  /**
   * 专家（可选）
   */
  agents: Array<string>

  /**
   * 技能（可选）
   */
  skills: Array<string>

  /**
   * 工具
   */
  tools: Array<string>
}
