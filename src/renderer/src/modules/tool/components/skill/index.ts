// ==========================================
//  Skill 工具：供 AI 通过 tool call 按需加载 skill（渐进式披露）
// ==========================================

import { ToolFunction } from '@/domain'
import {
  type LocalSkill,
  localSkillContentGet,
  localSkillList
} from '@/modules/skill'

const findSkill = async (identifier: string): Promise<LocalSkill | undefined> => {
  const key = identifier.trim().toLowerCase()
  if (!key) return undefined
  return findSkillSync(key, await localSkillList())
}

const findSkillSync = (key: string, skills: LocalSkill[]): LocalSkill | undefined =>
  skills.find((e) => e.name.toLowerCase() === key || e.dirName.toLowerCase() === key)

export const skillTools: ToolFunction[] = [
  {
    name: 'load_skill',
    label: '加载 Skill',
    description:
      '根据名称加载指定 Skill 的完整内容（SKILL.md）。当用户的任务与某个可用 Skill 的描述相匹配时，先调用此工具获取该 Skill 的完整指令，再按指令执行。返回内容中引用的配套文件（脚本、模板等）可用 file_read 读取。',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '要加载的 Skill 名称（frontmatter name 或目录名）' }
      },
      required: ['name']
    },
    risk: 'safe',
    handler: async (...params: unknown[]) => {
      const { name } = params[0] as { name: string }
      const skill = await findSkill(name)
      if (!skill) return { error: `未找到名为 "${name}" 的 Skill` }
      const content = await localSkillContentGet(skill)
      return { name: skill.name, path: skill.path, content }
    }
  }
]
