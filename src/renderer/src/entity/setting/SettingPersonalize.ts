import { CommonSelect } from '@/domain'

/**
 * - 默认：不设定特定风格
 * - 专业严谨：清晰、准确、值得信赖
 * - 亲和友善：温暖、平易近人、鼓励支持
 * - 直言不讳：简明扼要、不废话、直击痛点
 * - 天马行空：富有想象力，善用比喻类比
 * - 高效务实：最少文字、最大信息量
 * - 毒舌吐槽：犀利吐槽，但绝不伤人
 * - 启发引导：用提问引导思考、授人以渔
 */
export type SettingPersonalizeStyle = 'default'

export const SettingPersonalizeStyleOptions: Array<CommonSelect<SettingPersonalizeStyle>> = [
  {
    label: '默认',
    value: 'default',
    desc: '不设定特定风格'
  }
]

/** 个性化设定文件的生效范围 */
export type PersonalizeScope = 'all' | 'design' | 'writing'

/**
 * 个性化设定文件配置：soul/ 下的 .md 文件（用户可在应用外直接编辑），
 * 非空内容注入主 Agent 系统提示词的稳定前缀（@see modules/personalize）。
 */
export interface PersonalizeFileConfig {
  /** 字段名（沿用原 SettingPersonalize 字段名） */
  field: 'style' | 'design' | 'write' | 'AGENTS' | 'USER'
  /** soul/ 下的文件名 */
  file: string
  title: string
  description: string
  /** 生效范围：所有主 Agent 对话 / 仅 design + ppt / 仅 writing */
  scope: PersonalizeScope
  /** 编辑器占位示例 */
  placeholder: string
}

export const PERSONALIZE_FILE_CONFIG: Array<PersonalizeFileConfig> = [
  {
    field: 'AGENTS',
    file: 'AGENT.md',
    title: '行为准则',
    description: '希望助手始终遵循的规则和偏好，直接影响所有对话',
    scope: 'all',
    placeholder: '例如：回复默认使用中文；改代码前先说明方案；不确定时先提问'
  },
  {
    field: 'design',
    file: 'DESIGN.md',
    title: '设计偏好',
    description: '「设计创意 / PPT」类型的对话才会加载',
    scope: 'design',
    placeholder: '例如：偏好极简风格，主色低饱和，留白充足，少用渐变'
  },
  {
    field: 'write',
    file: 'WRITE.md',
    title: '写作偏好',
    description: '「写作」类型的对话才会加载',
    scope: 'writing',
    placeholder: '例如：口语化表达，少用长句，避免 AI 腔和排比堆砌'
  },
  {
    field: 'style',
    file: 'IDENTITY.md',
    title: '身份与风格',
    description: '基本风格和语调，影响所有对话',
    scope: 'all',
    placeholder: '例如：专业严谨，回答清晰准确；技术解释附带简要示例'
  },
  {
    field: 'USER',
    file: 'USER.md',
    title: '用户画像',
    description: '关于我自己（身份、技术栈、偏好背景），帮助助手更懂你',
    scope: 'all',
    placeholder: '例如：前端工程师，Mac 用户，包管理用 yarn，常用 Vue3 + TypeScript'
  }
]
