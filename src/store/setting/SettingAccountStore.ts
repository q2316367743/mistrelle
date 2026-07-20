import { defineStore } from 'pinia'
import { useUtoolsDbAsync } from '@/hooks'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { buildSettingAccount } from '@/entity'
import { HttpRequest } from '@/domain'

export const useSettingAccountStore = defineStore('SettingAccountStore', () => {
  const state = useUtoolsDbAsync(LocalNameEnum.SETTING_ACCOUNT, buildSettingAccount())

  const skillhubConfig = computed<Partial<HttpRequest>>(() => {
    if (!state.value.skillhub) return {}
    return {
      cookie: `skh_token=${state.value.skillhub.substring(3)}`
    }
  })

  return {
    state,
    skillhubConfig
  }
})
