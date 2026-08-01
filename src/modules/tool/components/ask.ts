import { ToolFunction, ToolProperty } from '@/domain'

export interface AskOption {
  key: string
  label: string
  description?: string
}

export interface AskArgs {
  question: string
  options: AskOption[]
}

/** options 参数的 JSON Schema，供 ask 工具声明与 UI 卡片解析共用 */
export const ASK_OPTIONS_PROPERTY: ToolProperty = {
  type: 'array',
  description:
    '候选答案，2-5 个，每个含 key 与 label（展示文本）；可给 description 说明该选项的含义与后果',
  items: {
    type: 'object',
    description: '单个选项',
    properties: {
      key: { type: 'string', description: '选项唯一标识' },
      label: { type: 'string', description: '选项展示文本（用户会看到）' },
      description: { type: 'string', description: '选项的补充说明（可选）' }
    },
    required: ['key', 'label']
  }
}

/**
 * ask 工具：需要用户做出决策或补充信息时调用。
 * 由 executeToolCalls 特殊处理走 InteractiveBridge，handler 不会被直接调用，
 * 仅作为兜底（如模型在无 UI 环境回放时）返回占位文本。
 */
export const askTool: ToolFunction = {
  name: 'ask',
  label: '询问用户',
  description:
    '当你需要用户做出决策或补充信息时调用：给出问题与 2-5 个候选选项，用户会看到并选择一个答案（也可自行输入）。用户的选择会作为你的参考输入，请基于它继续当前任务。优先提供选项，避免开放式提问。',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: '需要用户回答的问题' },
      options: ASK_OPTIONS_PROPERTY
    },
    required: ['question', 'options']
  },
  risk: 'safe',
  handler: async () => 'ask 工具由交互界面回答，不会直接执行'
}
