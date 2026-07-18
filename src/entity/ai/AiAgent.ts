import { BaseEntity } from '@/entity'

export interface AiAgentForm {
  // ------------------------------- 基础 -------------------------------

  /**
   * 分组名字
   */
  name: string

  /**
   * Agent 描述
   */
  description: string

  /**
   * 身份
   * > 定义助手是谁，包括名字、角色定位和能力范围。
   */
  identity: string

  /**
   * 性格
   * > 助手的性格、语气和行为准则。会强制助手遵循此设定。
   */
  personality: string

  /**
   * 关于我
   * > 关于你自己的信息（姓名、偏好等），助手会记住你。
   */
  aboutMe: string

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

export interface AiAgent extends BaseEntity, AiAgentForm {

  // ------------------------------- 状态 -------------------------------

  /**
   * 是否置顶
   */
  top: boolean
}


export const buildAiAgentForm = (): AiAgentForm => {
  return {
    name: '',
    description: '',
    identity: '',
    personality: '',
    aboutMe: '',
    tools: [],
    model: '',
    placeholder: '',
    think: false
  }
}

export const buildAiAgentPrompt = (form: AiAgentForm) => {
  return `## 身份
> 定义助手是谁，包括名字、角色定位和能力范围。
${form.identity}
## 性格
> 助手的性格、语气和行为准则。会强制助手遵循此设定。
${form.personality}
## 关于我
> 关于你自己的信息（姓名、偏好等），助手会记住你。
${form.aboutMe}

`
}
