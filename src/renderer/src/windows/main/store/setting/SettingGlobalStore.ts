import { defineStore } from 'pinia'
import { buildSettingGlobal, SettingGlobal } from '@/entity'
import { readJsonFile, writeJsonFile } from '@/utils/native'
import { getSettingGlobalPath } from '@/global/Constant'
import { useLog } from '@/hooks/UseLog'

export const useSettingGlobalStore = defineStore('setting:global', () => {
  const logger = useLog({ name: 'store:setting-global' })
  const state = ref<SettingGlobal>(buildSettingGlobal())

  ;(async () => {
    const global = await readJsonFile<SettingGlobal>(getSettingGlobalPath())
    if (global) state.value = global

    watch(
      state,
      async (val) => {
        await writeJsonFile(getSettingGlobalPath(), val)
      },
      { deep: true }
    )
  })()
    .then(() => logger.debug('设置-全局 初始化成功'))
    .catch((e) => logger.error('设置-全局 初始化失败', e))

  return {
    state
  }
})
