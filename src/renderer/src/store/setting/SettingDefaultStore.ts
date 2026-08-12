import { defineStore } from 'pinia'
import { useUtoolsDbAsync } from '@/hooks'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { buildSettingDefault } from '@/entity'

export const useSettingDefaultStore = defineStore('setting:default', () => {
  const state = useUtoolsDbAsync(LocalNameEnum.SETTING_DEFAULT, buildSettingDefault())

  return {
    state
  }
})
