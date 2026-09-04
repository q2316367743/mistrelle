import { defineStore } from 'pinia'
import { buildSettingDefault } from '@/entity'
import { readJsonFile, writeJsonFile } from '@/utils/native'
import { getSettingDefaultPath } from '@/global/Constant'
import { useLog } from '@/hooks/UseLog'

export const useSettingDefaultStore = defineStore('setting:default', () => {
  const logger = useLog({ name: 'store:setting-default' })
  const state = ref(buildSettingDefault())

  ;(async () => {
    const def = await readJsonFile<ReturnType<typeof buildSettingDefault>>(getSettingDefaultPath())
    if (def) state.value = def

    watch(
      state,
      async (val) => {
        await writeJsonFile(getSettingDefaultPath(), val)
      },
      { deep: true }
    )
  })()
    .then(() => logger.debug('设置-默认 初始化成功'))
    .catch((e) => logger.error('设置-默认 初始化失败', e))

  return {
    state
  }
})
