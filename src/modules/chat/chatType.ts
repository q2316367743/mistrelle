import { DESIGN_CANVAS_PROMPT } from '@/modules/tool/components/canvas/canvasPrompt'
import { CANVAS_TOOL_NAMES } from '@/modules/tool/components/canvas/canvasTools'

/**
 * 聊天类型（新建对话时选定，创建后锁定）：
 * - office：日常办公（默认，现有侧边栏：概览 / 工作空间 / 沙盒 / Agent 面板）
 * - writing：写作（文档侧边栏：文件树 + 编辑器 / md 预览）
 * - design：设计创意（画布侧边栏：t-select 选择 .canvas + leafer 画布渲染）
 */
export type ChatType = 'office' | 'writing' | 'design'

export const CHAT_TYPE_LABEL: Record<ChatType, string> = {
  office: '日常办公',
  writing: '写作',
  design: '设计创意'
}

export interface ChatTypeConfig {
  /** 具体名字，eg. 设计创意 */
  label: string
  /** 该类型固定提示词（放稳定 system 前缀，类型不变 → 不影响 prompt 缓存） */
  prompt: string
  /** 场景级工具白名单（design → 注入 canvas_*，名称与 canvasTools 定义一致） */
  tools: string[]
}

/**
 * 聊天类型单一数据源（类 toolGroups 风格）。
 * 同一类型的提示词固定、类型不变，因此类型提示词可安全进入稳定 system 前缀，
 * 保证 prompt 前缀稳定可缓存。
 */
export const CHAT_TYPE_CONFIG: Record<ChatType, ChatTypeConfig> = {
  office: {
    label: '日常办公',
    // 日常办公无额外场景指令，保持既有行为
    prompt: '',
    tools: []
  },
  writing: {
    label: '写作',
    prompt: [
      '## 写作模式',
      '你是一名专业写作助手。你的文档产出统一写入用户工作空间（workspace）或沙盒 outputs/ 目录下的 .md 文件。',
      '约定：',
      '- 使用 file_write 创建 / 更新 .md 文档，路径建议放在 outputs/ 下，便于侧边栏文档树展示与预览',
      '- 每次写作完成后，告知用户文档的完整路径',
      '- 文档结构清晰：使用标题层级、列表、引用组织内容'
    ].join('\n'),
    tools: []
  },
  design: {
    label: '设计创意',
    prompt: DESIGN_CANVAS_PROMPT,
    tools: [...CANVAS_TOOL_NAMES]
  }
}
