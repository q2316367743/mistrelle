import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { ToolFunction, type ChatMessage, type SkillContent, type TextContent } from '@/domain'
import { localSkillList, localSkillContentGet, localSkillFileRead } from './SkillService'
import type { LocalSkill } from './types'

// ==========================================
//  Skill 匹配辅助
// ==========================================

const findSkillSync = (identifier: string, skills: LocalSkill[]): LocalSkill | undefined => {
  const key = identifier.trim().toLowerCase()
  if (!key) return undefined
  return skills.find((e) => e.name.toLowerCase() === key || e.dirName.toLowerCase() === key)
}

const findSkill = async (identifier: string): Promise<LocalSkill | undefined> => {
  return findSkillSync(identifier, await localSkillList())
}

// ==========================================
//  Skill 工具：供 AI 通过 tool call 按需加载 skill（渐进式披露）
// ==========================================

export const skillTools: ToolFunction[] = [
  {
    name: 'load_skill',
    label: '加载 Skill',
    description:
      '根据名称加载指定 Skill 的完整内容（SKILL.md）。当用户的任务与某个可用 Skill 的描述相匹配时，先调用此工具获取该 Skill 的完整指令，再按指令执行。',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '要加载的 Skill 名称（frontmatter name 或目录名）' }
      },
      required: ['name']
    },
    handler: async (...params: unknown[]) => {
      const { name } = params[0] as { name: string }
      const skill = await findSkill(name)
      if (!skill) return { error: `未找到名为 "${name}" 的 Skill` }
      const content = await localSkillContentGet(skill)
      return { name: skill.name, path: skill.path, content }
    }
  },
  {
    name: 'read_skill_file',
    label: '读取 Skill 文件',
    description:
      '读取某个 Skill 目录下被引用的文件内容（如脚本、模板、参考资料）。文件路径通常来自 load_skill 返回内容中的引用。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '要读取的文件绝对路径' }
      },
      required: ['path']
    },
    handler: async (...params: unknown[]) => {
      const { path } = params[0] as { path: string }
      try {
        return { path, content: await localSkillFileRead(path) }
      } catch (err) {
        return { error: `读取失败：${err instanceof Error ? err.message : String(err)}` }
      }
    }
  }
]

// ==========================================
//  用户消息 Skill 解析
// ==========================================

// skill 名称允许字母、数字、下划线与连字符（如 fluent-design-web）
const SKILL_COMMAND_REGEX = /^\/([\w-]+)\s*([\s\S]*)$/

export interface SkillCommand {
  name: string
  rest: string
}

/**
 * 解析消息开头的 /skillname 指令
 * 匹配成功返回 skill 名称与剩余内容，否则返回 null
 */
export const parseSkillCommand = (content: string): SkillCommand | null => {
  const match = content.trim().match(SKILL_COMMAND_REGEX)
  if (!match) return null
  return { name: match[1], rest: (match[2] ?? '').trim() }
}

// ==========================================
//  提示词构建
// ==========================================

/**
 * 构建 skill 目录提示词：列出全部 skill 并声明 load_skill 的用法
 * 会话尚未激活任何 skill 时使用，由 AI 自主决定是否加载
 */
export const buildSkillCatalogPrompt = (skills: LocalSkill[]): string => {
  if (skills.length === 0) return ''
  const lines = skills.map((e) => `- ${e.name}：${e.description || e.dirName}`)
  return [
    '<available_skills>',
    '以下是当前可用的 Skill 列表，每个 Skill 是针对特定任务的专业指令集。',
    '当用户的任务与某个 Skill 的描述相匹配时，请先调用 `load_skill` 工具（传入该 Skill 名称）加载其完整指令，再严格按指令执行。',
    '',
    ...lines,
    '</available_skills>'
  ].join('\n')
}

/**
 * 构建指定 skill 的注入提示词：注入 skill 全文
 */
export const buildSkillInjectionPrompt = (skill: LocalSkill, content: string): string => {
  return [
    '<skill name="' + skill.name + '">',
    '用户已激活以下 Skill，请严格遵循其中的指令完成任务。',
    '',
    content,
    '</skill>'
  ].join('\n')
}

// ==========================================
//  聊天引擎入口（会话粘滞）
// ==========================================

// 提取一条用户消息的原始文本（不含 referenceContext）
const userText = (msg: ChatMessage): string => {
  if (msg.role !== 'user') return ''
  return msg.content
    .filter((c): c is TextContent => c.type === 'text')
    .map((c) => c.data)
    .join('')
}

// 从一条用户消息中解析出"激活 skill"：优先读取结构化的 SkillContent（输入框 mention 产生），
// 回退到解析文本中的 /name（兼容旧历史消息，它们没有 SkillContent）。
const resolveActiveSkillFromMessage = (
  msg: ChatMessage,
  skills: LocalSkill[]
): LocalSkill | undefined => {
  if (msg.role !== 'user') return undefined
  const structured = msg.content.find((c): c is SkillContent => c.type === 'skill')
  if (structured) {
    const matched = findSkillSync(structured.data.name, skills)
    if (matched) return matched
  }
  const cmd = parseSkillCommand(userText(msg))
  if (!cmd) return undefined
  return findSkillSync(cmd.name, skills)
}

/**
 * 供聊天引擎调用：解析会话并将 skill 上下文注入到 API 消息中（会话粘滞语义）
 *
 * - 激活 skill 从历史派生：取最近一个匹配到真实 skill 的 /name，后续不指定时沿用它，
 *   输入新的 /name 才切换；因此回滚 / 重问 / 清空等操作无需额外维护状态即可保持正确。
 * - 已激活 skill：系统提示词注入该 skill 全文；未激活：注入 skill 目录供 AI 自主加载。
 * - 同时剥离 API 用户消息中匹配到 skill 的 /name 前缀（保留 referenceContext 后缀），
 *   使历史消息中的指令前缀不会残留给模型。
 */
export const applySkillToChat = async (
  messages: ChatMessage[],
  apiMessages: ChatCompletionMessageParam[]
): Promise<void> => {
  const skills = await localSkillList()
  if (skills.length === 0) return

  // 1. 从历史中找最近一个匹配到真实 skill 的消息作为激活 skill（优先 SkillContent，回退 /name 文本）
  let activeSkill: LocalSkill | undefined
  for (let i = messages.length - 1; i >= 0; i--) {
    const matched = resolveActiveSkillFromMessage(messages[i], skills)
    if (matched) {
      activeSkill = matched
      break
    }
  }

  // 2. 注入系统提示词：已激活注入全文，否则注入目录
  const systemAppend = activeSkill
    ? buildSkillInjectionPrompt(activeSkill, await localSkillContentGet(activeSkill))
    : buildSkillCatalogPrompt(skills)
  const system = apiMessages.find((m) => m.role === 'system')
  if (systemAppend && system && typeof system.content === 'string') {
    system.content = `${system.content}\n\n${systemAppend}`
  }

  // 3. 剥离 API 用户消息中匹配到 skill 的 /name 前缀（rest 为空时保留，避免空消息）
  for (const m of apiMessages) {
    if (m.role !== 'user' || typeof m.content !== 'string') continue
    const cmd = parseSkillCommand(m.content)
    if (cmd && findSkillSync(cmd.name, skills) && cmd.rest.length > 0) {
      m.content = cmd.rest
    }
  }
}
