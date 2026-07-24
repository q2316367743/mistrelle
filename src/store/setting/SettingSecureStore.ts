import { defineStore } from 'pinia'
import { useUtoolsDbAsync } from '@/hooks'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { buildSettingSecure } from '@/entity'

export const useSettingSecureStore = defineStore('SettingSecureStore', () => {
  const state = useUtoolsDbAsync(LocalNameEnum.SETTING_SECURE, buildSettingSecure())

  return {
    state
  }
})
