import { defineStore } from 'pinia'
import { computed } from 'vue'
import { buildSettingSecure, getDefaultEgoBrowserPath } from '@/entity/setting/SettingSecured'
import { readJsonFile, writeJsonFile } from '@/utils/native'
import { getSettingSecurePath } from '@/global/Constant'
import { useLog } from '@/hooks/UseLog'

export const useSettingSecureStore = defineStore('SettingSecureStore', () => {
  const logger = useLog({ name: 'store:setting-secure' })
  const state = ref(buildSettingSecure())

  ;(async () => {
    const secure = await readJsonFile<ReturnType<typeof buildSettingSecure>>(getSettingSecurePath())
    if (secure) state.value = secure

    watch(
      state,
      async (val) => {
        await writeJsonFile(getSettingSecurePath(), val)
      },
      { deep: true }
    )
  })()
    .then(() => logger.debug('设置-安全 初始化成功'))
    .catch((e) => logger.error('设置-安全 初始化失败', e))

  // 用户配置 → 系统默认路径 → PATH 查找（存量用户无该字段时也能直接生效）
  const egoBrowserPath = computed(
    () => state.value.runtime.egoBrowser || getDefaultEgoBrowserPath() || 'ego-browser'
  )

  return { state, egoBrowserPath }
})
