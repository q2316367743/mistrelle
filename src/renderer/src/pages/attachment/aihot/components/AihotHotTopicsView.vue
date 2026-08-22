<template>
  <div class="aihot-topics">
    <div class="aihot-topics__toolbar">
      <span class="aihot-topics__hint">当前正在发生的热点事件，点击查看事件详情</span>
      <t-button variant="outline" shape="square" @click="load">
        <template #icon>
          <refresh-icon />
        </template>
      </t-button>
    </div>

    <div class="aihot-topics__body">
      <t-loading :loading="loading" size="small" class="aihot-topics__loading">
        <template v-if="list.length > 0">
          <div
            v-for="topic in list"
            :key="topic.id"
            class="aihot-topics__item"
            @click="handleClick(topic)"
          >
            <span
              class="aihot-topics__rank"
              :class="{ 'aihot-topics__rank--top': topic.rank <= 3 }"
            >
              {{ topic.rank }}
            </span>
            <div class="aihot-topics__main">
              <div class="aihot-topics__title" :title="topic.title">{{ topic.title }}</div>
              <div class="aihot-topics__meta">
                <t-tag size="small" variant="light">{{ topic.sourceCount }} 来源</t-tag>
                <t-tag size="small" variant="light" theme="warning">
                  {{ topic.signalCount }} 信号
                </t-tag>
                <span class="aihot-topics__sources" :title="topic.sourceNames.join('、')">
                  {{ topic.sourceNames.join('、') }}
                </span>
              </div>
            </div>
            <span class="aihot-topics__time">{{ aihotRelativeTime(topic.latestAt) }}</span>
          </div>
        </template>
        <empty-result v-else-if="!loading" title="暂无热点" tip="热点榜稍后更新，请刷新重试" />
      </t-loading>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { RefreshIcon } from 'tdesign-icons-vue-next'
import EmptyResult from '@/components/Result/EmptyResult.vue'
import { aihotApiV1HotTopics, type AihotHotTopic } from '@/modules/api/aihot'
import { openAihotStory } from './AihotStoryDrawer'
import { openAihotLink } from './AihotLinkDrawer'
import { aihotNotifyError } from '@/modules/aihot'
import { aihotRelativeTime, storyIdFromLink } from '../aihot-page-utils'

const loading = ref(false)
const list = ref<Array<AihotHotTopic>>([])

const load = async () => {
  loading.value = true
  try {
    const data = await aihotApiV1HotTopics()
    list.value = data.items ?? []
  } catch (e) {
    aihotNotifyError('加载热点榜失败', e)
  } finally {
    loading.value = false
  }
}

/**
 * story id 只取 API 返回的 links.story 末段；
 * 缺失或解析失败时禁止构造 id，改为打开 AIHOT 站内页
 */
const handleClick = (topic: AihotHotTopic) => {
  const storyId = storyIdFromLink(topic.links.story)
  if (storyId) {
    openAihotStory(storyId, topic.title)
  } else {
    openAihotLink(topic.links.aihot)
  }
}

onMounted(() => {
  load()
})
</script>
<style scoped lang="less">
.aihot-topics {
  display: flex;
  flex-direction: column;
  height: calc(100% - 10px);
  margin-top: 8px;
  overflow: hidden;
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
  background-color: var(--td-bg-color-container);

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--td-component-stroke);
  }

  &__hint {
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__loading {
    min-height: 200px;
    width: 100%;

    :deep(.empty-result-container) {
      height: auto;
      min-height: 240px;
    }
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--td-component-stroke);
    border-radius: var(--td-radius-medium);
    background-color: var(--td-bg-color-container);
    cursor: pointer;
    transition: background-color var(--fluent-transition-fast);
    margin-top: 8px;

    &:hover {
      background-color: var(--td-bg-color-container-hover);
    }
  }

  &__rank {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: var(--td-radius-circle);
    font: var(--td-font-body-small);
    font-weight: 700;
    color: var(--td-text-color-secondary);
    background-color: var(--td-bg-color-secondarycontainer);

    &--top {
      color: var(--td-brand-color);
      background-color: var(--td-brand-color-light);
    }
  }

  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: var(--td-font-body-medium);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__sources {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__time {
    flex-shrink: 0;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
