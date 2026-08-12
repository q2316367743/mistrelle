import { CommonSelect } from '@/domain'

/**
 * - 默认：不设定特定风格
 * - 专业严谨：清晰、准确、值得信赖
 * - 亲和友善：温暖、平易近人、鼓励支持
 * - 直言不讳：简明扼要、不废话、直击痛点
 * - 天马行空：富有想象力，善用比喻类比
 * - 高效务实：最少文字、最大信息量
 * - 毒舌吐槽：犀利吐槽，但绝不伤人
 * - 启发引导：用哦体温引导思考、授人以渔
 */
export type SettingPersonalizeStyle = 'default'

export const SettingPersonalizeStyleOptions: Array<CommonSelect<SettingPersonalizeStyle>> = [
  {
    label: '默认',
    value: 'default',
    desc: '不设定特定风格'
  }
]

/**
 * 个性化设计
 */
export interface SettingPersonalize {
  /**
   * 基本风格和语调
   * > 设置 插件 回复你的风格和语调。这不会影响 插件 的功能。
   */
  style: string

  /**
   * 自定义指令
   * > 「设计创意」类型的对话才会加载
   */
  design: string

  /**
   * 自定义指令
   * > 「写作风格」类型的对话才会加载
   */
  write: string

  /**
   * 自定义指令
   * > 告诉 插件 你希望它始终遵循的规则和偏好，这会直接影响所有对话。
   */
  AGENTS: string

  /**
   * USER.md
   * > 关于我自己
   */
  USER: string

  /**
   * MEMORY.md
   * > 长期记忆
   */
  MEMORY: string

  /**
   * 短期记忆
   * memory/YYYY-MM-DD.md
   */
  MEMORY_SHORT: string
}
