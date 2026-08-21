import { defineStore } from 'pinia'
import type { LocalSkill } from '@/modules/skill'
import { buildSettingSkill, SettingSkill } from '@/entity'
import { readJsonFile, writeJsonFile } from '@/utils/native'
import { getSettingSkillPath } from '@/global/Constant'
import { useLog } from '@/hooks/UseLog'

/**
 * Skill 启用状态：默认全部启用，仅记录被禁用的项（key = `agentKey/dirName`）
 */
export const useSettingSkillStore = defineStore('setting:skill', () => {
  const logger = useLog({ name: 'store:setting-skill' })
  const state = ref<SettingSkill>(buildSettingSkill())

  ;(async () => {
    const skill = await readJsonFile<SettingSkill>(getSettingSkillPath())
    if (skill?.disabled) state.value = skill

    watch(
      state,
      async (val) => {
        await writeJsonFile(getSettingSkillPath(), val)
      },
      { deep: true }
    )
  })()
    .then(() => logger.debug('设置-Skill 初始化成功'))
    .catch((e) => logger.error('设置-Skill 初始化失败', e))

  const skillKey = (skill: LocalSkill) => `${skill.agentKey}/${skill.dirName}`

  const isSkillEnabled = (skill: LocalSkill) => state.value.disabled[skillKey(skill)] !== true

  const setSkillEnabled = (skill: LocalSkill, val: boolean) => {
    const key = skillKey(skill)
    if (val) delete state.value.disabled[key]
    else state.value.disabled[key] = true
  }

  return {
    state,
    isSkillEnabled,
    setSkillEnabled
  }
})
