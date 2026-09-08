import { defineStore } from 'pinia'
import { buildSettingGlobal, SettingGlobal } from '@/entity'
import { readJsonFile, writeJsonFile } from '@/utils/native'
import { getSettingGlobalPath } from '@/global/Constant'
import { useLog } from '@/hooks/UseLog'

export const useSettingGlobalStore = defineStore('setting:global', () => {
  const logger = useLog({ name: 'store:setting-global' })
  const state = ref<SettingGlobal>(buildSettingGlobal())
  let resolveReady: () => void = () => {}
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve
  })

  ;(async () => {
    const global = await readJsonFile<SettingGlobal>(getSettingGlobalPath())
    if (global) state.value = { ...buildSettingGlobal(), ...global }

    watch(
      state,
      async (val) => {
        await writeJsonFile(getSettingGlobalPath(), val)
      },
      { deep: true }
    )
  })()
    .then(() => {
      resolveReady()
      logger.debug('设置-全局 初始化成功')
    })
    .catch((e) => {
      resolveReady()
      logger.error('设置-全局 初始化失败', e)
    })

  return {
    state,
    ready,
  }
})
