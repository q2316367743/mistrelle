import { defineStore } from 'pinia'
import { useUtoolsDbAsync } from '@/hooks'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { buildSettingAccount } from '@/entity'

export const useSettingAccountStore = defineStore('SettingAccountStore', () => {
  const state = useUtoolsDbAsync(LocalNameEnum.SETTING_ACCOUNT, buildSettingAccount())

  return {
    state
  }
})
