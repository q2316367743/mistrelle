<template>
  <page-layout :pl="`${l3}px`">
    <template #title>
      <div class="flex gap-8px items-center">
        <t-button theme="default" variant="text" shape="square" class="detail-btn" @click="goList">
          <template #icon><chevron-left-icon /></template>
        </t-button>
        <div>{{ style?.name || '设计风格详情' }}</div>
      </div>
    </template>
    <template #extra>
      <t-button
        v-if="style && isOnline"
        theme="primary"
        :loading="downloading"
        :disabled="downloaded"
        @click="handleDownload"
      >
        <template #icon><DownloadIcon /></template>
        {{ downloaded ? '已下载到本地' : '下载到本地' }}
      </t-button>
      <t-button
        v-else-if="style && !style.isSystem"
        theme="default"
        variant="outline"
        @click="handleEdit"
      >
        <template #icon><EditIcon /></template>
        编辑
      </t-button>
    </template>

    <div v-if="loading" class="detail-loading">
      <t-loading size="large" />
    </div>

    <design-style-detail-body v-else-if="style" :style="style" :online="isOnline" />

    <div v-else class="detail-empty">
      <t-empty title="设计风格不存在" description="该风格可能已被删除">
        <t-button theme="primary" @click="goList">返回风格列表</t-button>
      </t-empty>
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeftIcon, EditIcon, DownloadIcon } from 'tdesign-icons-vue-next'
import {
  AiDesignStyle,
  toAiDesignStyleForm
} from '@/entity'
import { useAuthStore, useDesignStyleStore } from '@/store'
import { MessageUtil } from '@/utils/modal'
import { openDesignStylePut } from '@/pages/design/list/modals/DesignStylePutDialog'
import DesignStyleDetailBody from './components/DesignStyleDetailBody.vue'
import { mapRemoteToDesignStyle } from '@/pages/design/list/useOnlineDesignStyles'
import { useTitlePadding } from '@/hooks'

const route = useRoute()
const router = useRouter()
const store = useDesignStyleStore()
const { l3 } = useTitlePadding()

const id = computed(() => String(route.params.id))
const isOnline = computed(() => route.meta.online === true)
const stylesLocked = computed(() => !useAuthStore().features.extendedDesignStyles)
const downloaded = computed(() => store.hasLocal(id.value))

const loading = ref(true)
const downloading = ref(false)
const style = ref<AiDesignStyle>()

const loadOnline = async () => {
  if (stylesLocked.value) {
    style.value = undefined
    MessageUtil.warning('在线设计风格为会员功能，可在 设置 → 账户 开通')
    return
  }
  const res = await window.preload.auth.getDesignStyle(id.value)
  if (!res.ok) {
    style.value = undefined
    MessageUtil.error(res.msg)
    return
  }
  style.value = mapRemoteToDesignStyle(res.data)
}

const load = async () => {
  loading.value = true
  try {
    if (isOnline.value) await loadOnline()
    else style.value = await store.getDetail(id.value)
  } finally {
    loading.value = false
  }
}

watch([id, isOnline], () => void load(), { immediate: true })

const goList = () => router.push('/design/list')

const handleEdit = async () => {
  await openDesignStylePut(id.value)
  await load()
}

const handleDownload = async () => {
  if (!style.value || downloaded.value) return
  if (stylesLocked.value) {
    MessageUtil.warning('在线设计风格为会员功能，可在 设置 → 账户 开通')
    return
  }
  downloading.value = true
  try {
    const savedId = await store.put(toAiDesignStyleForm(style.value), style.value.id)
    if (!savedId) {
      MessageUtil.error('下载失败')
      return
    }
    MessageUtil.success(`已添加「${style.value.name}」到本地`)
  } catch (e) {
    MessageUtil.error('下载失败', e)
  } finally {
    downloading.value = false
  }
}
</script>

<style scoped lang="less">
.detail-loading,
.detail-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}
.detail-btn {
  z-index: 60;
  -webkit-app-region: no-drag;
}
</style>
