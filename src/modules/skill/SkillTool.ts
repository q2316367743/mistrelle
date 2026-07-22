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
    '<skill>',
    `name: ${skill.name}`,
    `path: ${skill.path}`,
    '用户已激活以下 Skill，请严格遵循其中的指令完成任务。',
    '当 Skill 内容引用同目录下的脚本、模板或资料文件时，请基于上述 path 拼出绝对路径后调用 `read_skill_file`。',
    '',
    content,
    '</skill>'
  ].join('\n')
}

// ==========================================
//  聊天引擎入口（单轮显式激活）
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
 * 构建本次请求的动态 skill 提示词。
 * 当前最后一条用户消息显式指定的 skill 会注入全文；历史 skill 只作为可手动加载线索。
 */
export const buildSkillDynamicPrompt = async (messages: ChatMessage[]): Promise<string> => {
  const skills = await localSkillList()
  if (skills.length === 0) return ''

  const userMessages = messages.filter((msg) => msg.role === 'user')
  const latestUser = userMessages[userMessages.length - 1]
  const activeSkill = latestUser ? resolveActiveSkillFromMessage(latestUser, skills) : undefined
  const historySkills = userMessages
    .map((msg) => resolveActiveSkillFromMessage(msg, skills))
    .filter((skill): skill is LocalSkill => !!skill && skill.name !== activeSkill?.name)
  const historySkillMap = new Map(historySkills.map((skill) => [skill.name, skill]))

  const parts = [buildSkillCatalogPrompt(skills)]

  if (historySkillMap.size > 0) {
    parts.push(
      [
        '<history_skills>',
        '历史对话中用户曾指定以下 Skill。它们不代表当前已激活；仅当当前问题需要追溯历史上下文时，可调用 `load_skill` 手动加载。',
        '',
        ...Array.from(historySkillMap.values()).map(
          (skill) => `- ${skill.name}：${skill.description || skill.dirName}`
        ),
        '</history_skills>'
      ].join('\n')
    )
  }

  if (activeSkill) {
    parts.push(buildSkillInjectionPrompt(activeSkill, await localSkillContentGet(activeSkill)))
  }

  return parts.filter(Boolean).join('\n\n')
}
