import type {
  ChatCompletionMessageParam,
  ChatCompletionTool
} from 'openai/resources/chat/completions'
import type { TokenBreakdown } from '@/domain'

/** 技能工具：其工具结果计入「技能」分类（load_skill / read_skill_file），其余工具结果计入「工具及子智能体」 */
const SKILL_TOOL_NAMES = new Set(['load_skill', 'read_skill_file'])

/**
 * 估算 token 数（中英文混合：CJK 约 1 token/字，其余约 1 token/4 字符）
 */
export const estimateTokens = (text: string): number => {
  if (!text) return 0
  const cjkRegex = /[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯가-힯]/u
  let tokens = 0
  for (const char of text) {
    if (cjkRegex.test(char)) tokens += 1
  }
  const rest = text.replace(/[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯가-힯]/gu, ' ')
  const words = rest.trim().split(/\s+/).filter(Boolean)
  for (const word of words) {
    tokens += Math.max(1, Math.round(word.length / 4))
  }
  return tokens
}

/** 格式化 token 数：≥1m 显示 1.0m，≥1k 显示 192.0k，否则原值 */
export const formatTokens = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return `${value}`
}

/** 提取 API 消息的纯文本内容（兼容 string / 多模态数组 / null） */
const messageText = (message: ChatCompletionMessageParam): string => {
  const content = message.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => (part.type === 'text' ? part.text : ''))
      .join('')
  }
  return ''
}

/**
 * 按来源估算一次请求上下文的 token 构成：
 * - system：系统提示词（减去技能目录，技能目录归入「技能」）
 * - conversation：user / assistant 消息文本
 * - tools：tool 结果 + assistant tool_calls 参数 + 工具定义 JSON + spawn_agent 摘要
 * - skills：技能目录 + load_skill / read_skill_file 的工具结果
 * 返回值仅为相对比例，由调用方归一化到 API usage 的精确 prompt_tokens。
 */
export const estimateTokenBreakdown = (
  apiMessages: ChatCompletionMessageParam[],
  toolDefs: ChatCompletionTool[],
  skillCatalogPrompt: string
): TokenBreakdown => {
  // 第一遍：收集 tool_call_id → 工具名映射，用于给 tool 结果归类
  const callNameMap = new Map<string, string>()
  for (const message of apiMessages) {
    if (message.role !== 'assistant' || !message.tool_calls) continue
    for (const call of message.tool_calls) {
      if (call.type === 'function') callNameMap.set(call.id, call.function.name)
    }
  }

  const result: TokenBreakdown = { system: 0, tools: 0, conversation: 0, skills: 0 }
  for (const message of apiMessages) {
    const text = messageText(message)
    if (message.role === 'system') {
      result.system += estimateTokens(text)
      continue
    }
    if (message.role === 'user') {
      result.conversation += estimateTokens(text)
      continue
    }
    if (message.role === 'assistant') {
      result.conversation += estimateTokens(text)
      if (message.tool_calls) {
        for (const call of message.tool_calls) {
          if (call.type === 'function') result.tools += estimateTokens(call.function.arguments)
        }
      }
      continue
    }
    if (message.role === 'tool') {
      const name = message.tool_call_id ? callNameMap.get(message.tool_call_id) : undefined
      if (name && SKILL_TOOL_NAMES.has(name)) {
        result.skills += estimateTokens(text)
      } else {
        result.tools += estimateTokens(text)
      }
    }
  }

  // 工具定义（随请求体发送）计入「工具及子智能体」
  result.tools += estimateTokens(JSON.stringify(toolDefs))
  // 技能目录原本拼在 system 前缀中，拆分到「技能」，并从 system 中扣除
  const catalogTokens = estimateTokens(skillCatalogPrompt)
  result.system = Math.max(0, result.system - catalogTokens)
  result.skills += catalogTokens
  return result
}

/**
 * 按 targetTotal 归一化：各分类按占比缩放并修正取整误差，使四类之和严格等于 targetTotal。
 * 估算总和为 0（全部空上下文）时返回全 0。
 */
export const normalizeTokenBreakdown = (
  breakdown: TokenBreakdown,
  targetTotal: number
): TokenBreakdown => {
  const total = breakdown.system + breakdown.tools + breakdown.conversation + breakdown.skills
  if (total <= 0) return { system: 0, tools: 0, conversation: 0, skills: 0 }
  const scale = targetTotal / total
  const scaled: TokenBreakdown = {
    system: Math.round(breakdown.system * scale),
    tools: Math.round(breakdown.tools * scale),
    conversation: Math.round(breakdown.conversation * scale),
    skills: Math.round(breakdown.skills * scale)
  }
  // 修正取整产生的 ±几 token 误差，补到 system 上保证总和精确
  const sum = scaled.system + scaled.tools + scaled.conversation + scaled.skills
  scaled.system += targetTotal - sum
  return scaled
}
