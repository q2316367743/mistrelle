import { BaseEntity } from '@/entity'
import { toolMap } from '@/modules/tool'

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
  const parts: string[] = []

  if (form.identity.trim()) {
    parts.push(`## 身份\n\n定义你是谁——你的名字、角色定位以及能力范围。这是你回答问题的根本出发点。\n${form.identity}`)
  }

  if (form.personality.trim()) {
    parts.push(`## 性格\n\n设定你的性格特征、语气风格和行为准则。回复必须严格遵循此设定。\n${form.personality}`)
  }

  if (form.aboutMe.trim()) {
    parts.push(`## 关于我\n\n用户的个人信息（姓名、偏好、习惯等）。在对话中记住这些信息，并据此提供个性化回复。\n${form.aboutMe}`)
  }

  if (form.tools.length > 0) {
    const labels = form.tools.map(name => toolMap[name]?.label || name)
    parts.push(`## 可用工具\n\n你拥有以下工具的调用权限，可在需要时使用它们来获取信息或执行操作：\n- ${labels.join('\n- ')}`)
  }

  return parts.length > 0 ? parts.join('\n\n') + '\n\n' : ''
}
