import { defineStore } from 'pinia'
import { useUtoolsDbAsync } from '@/hooks'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { buildSettingGlobal, SettingGlobal } from '@/entity'

export const useSettingGlobalStore = defineStore('setting:global', () => {
  const state = useUtoolsDbAsync<SettingGlobal>(LocalNameEnum.SETTING_GLOBAL, buildSettingGlobal())

  return {
    state
  }
})
