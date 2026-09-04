import { ToolFunction, ToolProperty } from '@/domain'

export interface AskOption {
  key: string
  label: string
  description?: string
}

export interface AskQuestion {
  question: string
  options: AskOption[]
}

/** 用户作答后生成的「问题 + 答案」对，写入 toolcall ext 供 UI 结果卡片渲染 */
export interface AskAnswerItem {
  question: string
  answer: string
}

export interface AskArgs {
  question?: string
  options?: AskOption[]
  /** 一次询问多个问题时使用，每个问题带自己的候选选项 */
  questions?: AskQuestion[]
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

/** questions 参数的 JSON Schema：一次询问多个问题，每个问题含 question 与 options */
const ASK_QUESTIONS_PROPERTY: ToolProperty = {
  type: 'array',
  description:
    '一次询问多个问题时使用：数组每个元素是一个问题（含 question 与各自独立的 options）。提供该字段后无需再传 question / options。',
  items: {
    type: 'object',
    description: '单个问题',
    properties: {
      question: { type: 'string', description: '需要用户回答的问题' },
      options: ASK_OPTIONS_PROPERTY
    },
    required: ['question', 'options']
  }
}

/**
 * 归一化 ask 工具参数为问题列表：优先解析 questions 数组（多问题），
 * 回退单个 question + options（单问题，兼容历史调用）。
 * 过滤掉缺 question 的非法项，保证调用方拿到的是有效问题。
 */
export const normalizeAskArgs = (args: Record<string, unknown>): AskQuestion[] => {
  const list = Array.isArray(args.questions) ? args.questions : []
  if (list.length > 0) {
    return list
      .filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === 'object' && typeof item.question === 'string'
      )
      .map((item) => ({
        question: item.question as string,
        options: Array.isArray(item.options) ? (item.options as AskOption[]) : []
      }))
      .filter((item) => item.question.trim() !== '')
  }
  if (typeof args.question === 'string' && args.question.trim()) {
    return [
      {
        question: args.question,
        options: Array.isArray(args.options) ? (args.options as AskOption[]) : []
      }
    ]
  }
  return []
}

/**
 * 把「问题 + 答案」对格式化为给模型的工具结果文本。
 * 问题与答案一并返回，让模型能对应每一问的答案；全部未作答时提示自行判断。
 */
export const formatAskResult = (items: AskAnswerItem[]): string => {
  if (items.length === 0 || items.every((item) => !item.answer)) {
    return '用户未回答，请自行判断或继续推进任务'
  }
  const lines = items.map(
    (item, index) =>
      `${index + 1}. 问题：${item.question}\n   回答：${item.answer || '（未作答）'}`
  )
  return `用户回答：\n${lines.join('\n')}`
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
    '当你需要用户做出决策或补充信息时调用。可以一次询问多个问题：用 questions 数组给出每个问题（含各自 2-5 个候选选项）；也可以只询问单个问题（用 question + options）。用户会看到所有问题并分别选择答案（也可自行输入），所有答案会一起返回给你。优先提供选项，避免开放式提问；一次要问多个问题时尽量合并进同一次调用，减少打断。',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: '单个问题的题干（仅在只询问一个问题时使用）' },
      options: ASK_OPTIONS_PROPERTY,
      questions: ASK_QUESTIONS_PROPERTY
    },
    required: []
  },
  risk: 'safe',
  handler: async () => 'ask 工具由交互界面回答，不会直接执行'
}
