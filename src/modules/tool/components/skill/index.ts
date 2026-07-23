// ==========================================
//  Skill 工具：供 AI 通过 tool call 按需加载 skill（渐进式披露）
// ==========================================

import { ToolFunction } from '@/domain'
import {
  type LocalSkill,
  localSkillContentGet,
  localSkillFileRead,
  localSkillList
} from '@/modules/skill'

const findSkillSync = (identifier: string, skills: LocalSkill[]): LocalSkill | undefined => {
  const key = identifier.trim().toLowerCase()
  if (!key) return undefined
  return skills.find((e) => e.name.toLowerCase() === key || e.dirName.toLowerCase() === key)
}

const findSkill = async (identifier: string): Promise<LocalSkill | undefined> => {
  return findSkillSync(identifier, await localSkillList())
}

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
