import type { LocalSkill } from './types'

// ==========================================
//  提示词构建
// ==========================================

/**
 * 构建 skill 目录提示词：列出全部 skill 并声明 load_skill 的用法。
 * 仅含 skill 名称与描述，内容稳定，适合作为可缓存的 system 前缀的一部分。
 * skill 正文不在此注入——用户显式指定时由 load_skill 工具按需在对话中加载。
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
