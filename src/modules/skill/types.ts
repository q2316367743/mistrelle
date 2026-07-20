/**
 * Skill 所属 Agent（即 skills 目录来源）
 */
export interface SkillAgent {
  // 唯一标识
  key: string
  // 展示名称
  name: string
  // skills 目录绝对路径
  path: string
}

/**
 * 本地 Skill
 * 一个 Skill 对应某个 agent skills 目录下的一个文件夹，文件夹内包含 SKILL.md
 */
export interface LocalSkill {
  // 目录名
  dirName: string
  // 名称（SKILL.md frontmatter name）
  name: string
  // 描述（SKILL.md frontmatter description）
  description: string
  // 目录完整路径
  path: string
  // 所属 agent key
  agentKey: string
  // 所属 agent 名称
  agentName: string
  // 最后修改时间
  updatedAt: number
}

export interface LocalSkillForm {
  agentKey: string
  dirName: string
  name: string
  description: string
}

/**
 * Skill 目录下的文件
 */
export interface LocalSkillFile {
  name: string
  path: string
  relativePath: string
  size: number
  mtime: number
}
