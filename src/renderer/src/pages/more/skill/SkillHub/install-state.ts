import type { LocalSkill } from '@/modules/skill'
import type { ApiSkill } from '@/modules/skillhub'
import { versionCompare } from '@/utils/lang/FieldUtil'

/**
 * Skill 在本地 Agent 目录中的安装状态
 */
export interface SkillInstallState {
  installed: boolean
  // 本地最高版本
  localVersion?: string
  // 远端存在更高版本
  upgradable: boolean
  // 已安装副本（可能分布在多个 Agent）
  copies: LocalSkill[]
}

/**
 * 根据本地 Skill 列表计算某个 Hub Skill 的安装状态：
 * 按 slug 匹配目录名，取副本中的最高版本与远端版本比较
 */
export const buildInstallState = (
  skill: ApiSkill,
  locals: Array<LocalSkill>
): SkillInstallState => {
  const copies = locals.filter((e) => e.dirName === skill.slug)
  if (copies.length === 0) {
    return { installed: false, localVersion: undefined, upgradable: false, copies }
  }
  const versions = copies
    .map((e) => e.version)
    .filter((v): v is string => !!v)
    .sort((a, b) => versionCompare(b, a))
  const localVersion = versions[0]
  const upgradable = !!skill.version && !!localVersion && versionCompare(skill.version, localVersion) > 0
  return { installed: true, localVersion, upgradable, copies }
}
