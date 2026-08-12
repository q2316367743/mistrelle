<template>
  <t-layout class="subscribe-page">
    <t-aside class="subscribe-page__aside" width="232px">
      <blogger-list
        :list="bloggers"
        :selected-id="selectedBloggerId"
        @select="handleSelectBlogger"
        @add="handleAdd"
        @setting="handleSetting"
        @remove="handleRemoveBlogger"
      />
    </t-aside>

    <t-content class="subscribe-page__main">
      <subscribe-detail
        v-if="selectedSubscribe && selectedBlogger"
        :project-id="id"
        :blogger="selectedBlogger"
        :item="selectedSubscribe"
        @back="selectedSubscribeId = ''"
        @refresh="handleRefresh"
        @remove="handleRemoveSubscribe"
      />
      <subscribe-list-view
        v-else-if="selectedBlogger"
        :project-id="id"
        :blogger="selectedBlogger"
        :items="items"
        :selected-id="selectedSubscribeId"
        @select="(item) => (selectedSubscribeId = item.id)"
        @setting="handleSetting"
        @refresh="handleRefresh"
      />
      <t-empty
        v-else
        title="选择一位博主"
        description="在左侧选择博主，或点击「添加博主」"
        class="mt-25vh"
      />
    </t-content>
  </t-layout>
</template>
<script lang="ts" setup>
import type { SubscribeBlogger, SubscribeItem } from '@/entity/project/Subscribe'
import {
  subscribeBloggerList,
  subscribeBloggerRemove,
  subscribeBloggerSyncVideos,
  subscribeVideoList,
  subscribeVideoRemove
} from '@/modules/subscribe'
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'
import { openBloggerPutDialog } from './modals/BloggerPutDialog'
import { openBloggerSettingDialog } from './modals/BloggerSettingDialog'
import BloggerList from './components/BloggerList.vue'
import SubscribeListView from './components/SubscribeListView.vue'
import SubscribeDetail from './components/SubscribeDetail.vue'

const props = defineProps<{ id: string }>()

const bloggers = ref<SubscribeBlogger[]>([])
const selectedBloggerId = ref('')
const selectedSubscribeId = ref('')
const items = ref<SubscribeItem[]>([])

const selectedBlogger = computed(() => bloggers.value.find((b) => b.id === selectedBloggerId.value))
const selectedSubscribe = computed(() =>
  items.value.find((v) => v.id === selectedSubscribeId.value)
)

const loadBloggers = async () => {
  bloggers.value = await subscribeBloggerList(props.id)
  if (!selectedBlogger.value) {
    selectedSubscribeId.value = ''
  }
}

const loadVideos = async () => {
  if (!selectedBloggerId.value) {
    items.value = []
    return
  }
  items.value = await subscribeVideoList(props.id, selectedBloggerId.value)
}

const handleSelectBlogger = async (bloggerId: string) => {
  selectedBloggerId.value = bloggerId
  selectedSubscribeId.value = ''
  await loadVideos()
}

const handleAdd = async () => {
  openBloggerPutDialog({
    projectId: props.id,
    onSuccess: async (bloggerId) => {
      await loadBloggers()
      selectedSubscribeId.value = ''
      await handleSelectBlogger(bloggerId)
      try {
        await subscribeBloggerSyncVideos(props.id, bloggerId)
        await loadVideos()
      } catch (e) {
        MessageUtil.error('同步视频列表失败', e)
      }
    }
  })
}

const handleSetting = (blogger: SubscribeBlogger) => {
  openBloggerSettingDialog({
    projectId: props.id,
    blogger,
    onSuccess: () => {
      loadBloggers()
    }
  })
}

const handleRefresh = async () => {
  await loadVideos()
  await loadBloggers()
}

const handleRemoveBlogger = async (blogger: SubscribeBlogger) => {
  try {
    await MessageBoxUtil.confirm(`确定删除博主「${blogger.name}」及其全部订阅？`, '删除博主')
    await subscribeBloggerRemove(props.id, blogger.id)
    if (selectedBloggerId.value === blogger.id) {
      selectedBloggerId.value = ''
      selectedSubscribeId.value = ''
    }
    await loadBloggers()
    await loadVideos()
    MessageUtil.success('已删除')
  } catch {
    // 用户取消
  }
}

const handleRemoveSubscribe = async () => {
  if (!selectedBlogger.value || !selectedSubscribe.value) return
  try {
    await MessageBoxUtil.confirm(`确定删除订阅「${selectedSubscribe.value.title}」？`, '删除订阅')
    await subscribeVideoRemove(props.id, selectedBlogger.value.id, selectedSubscribe.value.id)
    selectedSubscribeId.value = ''
    await loadVideos()
    MessageUtil.success('已删除')
  } catch {
    // 用户取消
  }
}

watch(
  () => props.id,
  async () => {
    selectedBloggerId.value = ''
    selectedSubscribeId.value = ''
    await loadBloggers()
  },
  { immediate: true }
)
</script>
<style scoped lang="less">
.subscribe-page {
  display: flex;
  height: 100%;
  gap: 12px;

  &__aside {
    flex-shrink: 0;
    border-radius: var(--td-radius-medium);
    overflow: hidden;
    border-right: 1px solid var(--td-border-level-1-color);
  }

  &__main {
    flex: 1;
    min-width: 0;
    border-radius: var(--td-radius-medium);
    background-color: var(--td-bg-color-container);
    overflow: hidden;
    display: flex;
  }

  &__main > :deep(*) {
    flex: 1;
    min-width: 0;
  }
}
</style>
