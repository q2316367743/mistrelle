<template>
  <div ref="rootRef" class="aihot-story">
    <div v-if="loading" class="aihot-story__loading">
      <t-loading text="加载中..." size="large" />
    </div>

    <template v-else-if="notFound">
      <empty-result title="事件不存在或已下线" tip="该事件可能已被合并或移除">
        <t-button variant="outline" @click="emit('close')">关闭</t-button>
      </empty-result>
    </template>

    <template v-else>
      <div class="aihot-story__header">
        <div class="aihot-story__title-row">
          <span class="aihot-story__title">{{ story?.title ?? fallbackTitle }}</span>
          <t-button shape="square" variant="text" @click="emit('close')">
            <template #icon>
              <close-icon />
            </template>
          </t-button>
        </div>
        <div class="aihot-story__meta">
          <t-tag
            size="small"
            :theme="story?.status === 'active' ? 'warning' : 'success'"
            variant="light"
          >
            {{ story?.status === 'active' ? '进行中' : '已收束' }}
          </t-tag>
          <t-tag size="small" variant="light">{{ story?.sourceCount }} 来源</t-tag>
          <t-tag size="small" variant="light">{{ story?.reportCount }} 报道</t-tag>
          <span>首发 {{ aihotRelativeTime(story?.firstReportAt) }}</span>
          <span>更新 {{ aihotRelativeTime(story?.latestAt) }}</span>
        </div>
      </div>

      <t-alert v-if="story && !story.digest" theme="info" class="aihot-story__alert">
        AI 综述仍在生成中，可先浏览报道时间线
      </t-alert>
      <div v-else-if="story?.digest" class="aihot-story__digest">
        <div class="aihot-story__digest-label">
          AI 综述
          <span v-if="story.digestUpdatedAt">
            （{{ aihotRelativeTime(story.digestUpdatedAt) }}更新）
          </span>
        </div>
        <div class="aihot-story__digest-body">{{ story.digest }}</div>
      </div>

      <aihot-story-neighbors v-if="neighbors.length > 0" :neighbors="neighbors" @jump="jump" />

      <aihot-story-reports v-if="sortedReports.length > 0" :reports="sortedReports" />

      <div class="aihot-story__footer">
        <t-button variant="outline" size="small" @click="openOnSite">在 AIHOT 查看</t-button>
      </div>
    </template>
  </div>
</template>
<script lang="ts" setup>
import { CloseIcon } from 'tdesign-icons-vue-next'
import EmptyResult from '@/components/Result/EmptyResult.vue'
import {
  aihotApiV1Stories,
  type AihotStory,
  type AihotStoryNeighbor,
  type AihotStoryReport
} from '@/modules/api/aihot'
import AihotStoryNeighbors from './AihotStoryNeighbors.vue'
import AihotStoryReports from './AihotStoryReports.vue'
import { aihotNotifyError } from '@/modules/aihot'
import { aihotRelativeTime } from '../aihot-page-utils'

const props = defineProps<{
  publicId: string
  fallbackTitle?: string
}>()
const emit = defineEmits<{
  close: []
}>()

const rootRef = ref<HTMLElement | null>(null)
/** 抽屉内连续跳转：currentId 随 storyline / related 点击更新（id 均来自 API 返回） */
const currentId = ref(props.publicId)
const loading = ref(true)
const notFound = ref(false)
const story = ref<AihotStory | null>(null)

/** 报道按发布时间倒序（最新在前） */
const sortedReports = computed<Array<AihotStoryReport>>(() => {
  const reports = story.value?.reports ?? []
  return [...reports].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
})

const neighbors = computed<Array<AihotStoryNeighbor>>(() => [
  ...(story.value?.storyline ?? []),
  ...(story.value?.related ?? [])
])

const load = async () => {
  loading.value = true
  notFound.value = false
  try {
    const data = await aihotApiV1Stories(currentId.value)
    story.value = data.story
  } catch (e) {
    // 404：事件可能已被合并（308 由 axios 自动跟随，落到 404 才是不可用）
    if ((e as { response?: { status?: number } } | null)?.response?.status === 404) {
      notFound.value = true
      story.value = null
    } else {
      aihotNotifyError('加载事件详情失败', e)
    }
  } finally {
    loading.value = false
  }
}

const jump = (neighbor: AihotStoryNeighbor) => {
  currentId.value = neighbor.publicId
  story.value = null
  load()
  rootRef.value?.closest('.t-drawer__body')?.scrollTo({ top: 0 })
}

const openOnSite = () => {
  if (story.value?.links.aihot) {
    window.preload.inject.shell.openExternal(story.value.links.aihot)
  }
}

watch(currentId, () => {
  load()
})

onMounted(() => {
  load()
})
</script>
<style scoped lang="less">
.aihot-story {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 2px;

  &__loading {
    height: 40vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__title-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  &__title {
    flex: 1;
    min-width: 0;
    font: var(--td-font-title-large);
    font-weight: 700;
    color: var(--td-text-color-primary);
    word-break: break-word;
  }

  &__meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__alert {
    border-radius: var(--td-radius-medium);
  }

  &__digest {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    border: 1px solid var(--td-brand-color);
    border-radius: var(--td-radius-medium);
    background-color: var(--td-brand-color-light);
  }

  &__digest-label {
    font: var(--td-font-title-small);
    font-weight: 700;
    color: var(--td-text-color-primary);

    span {
      font: var(--td-font-body-small);
      font-weight: 400;
      color: var(--td-text-color-placeholder);
    }
  }

  &__digest-body {
    font: var(--td-font-body-medium);
    line-height: 1.8;
    color: var(--td-text-color-secondary);
    word-break: break-word;
    white-space: pre-line;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
  }
}
</style>
