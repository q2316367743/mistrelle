import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useUtoolsDbAsync } from '@/hooks'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { buildSettingSecure } from '@/entity'

export const useSettingSecureStore = defineStore('SettingSecureStore', () => {
  const state = useUtoolsDbAsync(LocalNameEnum.SETTING_SECURE, buildSettingSecure())

  const pythonPath = computed(() => state.value.runtime.python || 'python3')
  const nodePath = computed(() => state.value.runtime.node || 'node')
  const gitPath = computed(() => state.value.runtime.git || 'git')

  return { state, pythonPath, nodePath, gitPath }
})
