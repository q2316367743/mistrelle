<template>
  <page-layout title="系统设置">
    <t-list class="setting-list" split size="small">
      <t-list-item>
        <t-list-item-meta title="当前版本" description="已安装的客户端版本" />
        <template #action>
          <span class="version">{{ currentVersion }}</span>
        </template>
      </t-list-item>
      <t-list-item>
        <t-list-item-meta title="自动检查更新" description="启动后在后台检查是否有新版本" />
        <template #action>
          <t-switch v-model="setting.autoCheckUpdate" />
        </template>
      </t-list-item>
      <t-list-item>
        <t-list-item-meta title="检查更新" :description="statusText" />
        <template #action>
          <div class="flex items-center gap-8px">
            <t-button
              v-if="updater.status === 'downloaded'"
              theme="primary"
              :loading="busy"
              @click="onInstall"
            >
              重启安装
            </t-button>
            <t-button theme="primary" variant="outline" :loading="busy" @click="onCheck">
              检查更新
            </t-button>
          </div>
        </template>
      </t-list-item>
    </t-list>
  </page-layout>
</template>
<script lang="ts" setup>
import { useSettingGlobalStore } from '@/windows/main/store'
import {
  checkAppUpdatesManually,
  installAppUpdate,
} from '@/windows/main/modules/updater/startAppUpdater'

const { state: setting } = toRefs(useSettingGlobalStore())
const currentVersion = ref('—')
const busy = ref(false)
const updater = ref<UpdaterState>({
  status: 'idle',
  mode: 'builtin',
  currentVersion: '',
  availableVersion: null,
  releaseNotes: null,
  downloadUrl: null,
  percent: 0,
  error: null,
})
let stopListen: (() => void) | undefined

const statusText = computed(() => {
  if (updater.value.status === 'checking') return '正在检查…'
  if (updater.value.status === 'downloading') return `正在下载 ${Math.round(updater.value.percent)}%`
  if (updater.value.status === 'available' && updater.value.availableVersion) {
    return updater.value.mode === 'external'
      ? `发现新版本 ${updater.value.availableVersion}（网盘分发）`
      : `发现新版本 ${updater.value.availableVersion}`
  }
  if (updater.value.status === 'downloaded') return '更新已下载，重启后完成安装'
  if (updater.value.error) return updater.value.error
  return '从服务器获取最新安装包'
})

onMounted(async () => {
  currentVersion.value = await window.preload.inject.os.getAppVersion()
  updater.value = await window.preload.updater.getState()
  stopListen = window.preload.updater.onChanged((next) => {
    updater.value = next
  })
})

onUnmounted(() => {
  stopListen?.()
})

const onCheck = async () => {
  busy.value = true
  try {
    await checkAppUpdatesManually()
  } finally {
    busy.value = false
  }
}

const onInstall = async () => {
  busy.value = true
  try {
    await installAppUpdate()
  } finally {
    busy.value = false
  }
}
</script>
<style scoped lang="less">
.setting-list {
  padding: 0 16px 16px;
}
.version {
  color: var(--td-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
