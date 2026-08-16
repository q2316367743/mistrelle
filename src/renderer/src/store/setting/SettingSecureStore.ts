import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useUtoolsDbAsync } from '@/hooks'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { buildSettingSecure, getDefaultEgoBrowserPath } from '@/entity/setting/SettingSecured'

export const useSettingSecureStore = defineStore('SettingSecureStore', () => {
  const state = useUtoolsDbAsync(LocalNameEnum.SETTING_SECURE, buildSettingSecure())

  const pythonPath = computed(() => state.value.runtime.python || 'python3')
  const nodePath = computed(() => state.value.runtime.node || 'node')
  const gitPath = computed(() => state.value.runtime.git || 'git')
  // 用户配置 → 系统默认路径 → PATH 查找（存量用户无该字段时也能直接生效）
  const egoBrowserPath = computed(
    () => state.value.runtime.egoBrowser || getDefaultEgoBrowserPath() || 'ego-browser'
  )

  return { state, pythonPath, nodePath, gitPath, egoBrowserPath }
})
