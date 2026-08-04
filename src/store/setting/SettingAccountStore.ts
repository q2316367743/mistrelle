import { defineStore } from 'pinia'
import { useUtoolsDbAsync } from '@/hooks'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { buildSettingAccount, SettingAccount } from '@/entity'
import { HttpRequest } from '@/domain'
import { getFromOneByAsync, saveOneByAsync } from '@/utils/native'
import { useLog } from '@/hooks/UseLog'

export const useSettingAccountStore = defineStore('setting:account', () => {
  const logger = useLog({ name: 'setting:account' })
  const state = ref(buildSettingAccount())
  const rev = ref<string>()


  ;(async () => {

    const res = await getFromOneByAsync<SettingAccount>(LocalNameEnum.SETTING_ACCOUNT)
    if (res.record) {
      state.value = res.record
      rev.value = res.rev
    }else {
      if (window.preload.inject.getPlatform() === 'utools') {
        const user = window.preload.inject.os.getUser()
        if (user) {
          state.value.avatar = user.avatar
          state.value.nickname = user.nickname
        }
      }
    }


    watch(
      state,
      async (val) => {
        rev.value = await saveOneByAsync(LocalNameEnum.SETTING_ACCOUNT, val, rev.value)
      },
      { deep: true }
    )

  })()
    .then(() => logger.debug('账户信息初始化成功'))
    .catch((e) => logger.error('账户信息初始化失败', e))

  const skillhubConfig = computed<Partial<HttpRequest>>(() => {
    if (!state.value.skillhub) return {}
    return {
      cookie: `skh_token=${state.value.skillhub.substring(3)}`
    }
  })

  // 配置了 Context7 key 则在请求头携带 Authorization，否则返回空配置（走免 key 匿名额度）
  const context7Config = computed<Partial<HttpRequest>>(() => {
    if (!state.value.context7) return {}
    return {
      headers: { Authorization: `Bearer ${state.value.context7}` }
    }
  })

  return {
    state,
    skillhubConfig,
    context7Config
  }
})
