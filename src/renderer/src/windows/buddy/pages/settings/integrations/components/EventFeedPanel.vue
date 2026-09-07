<template>
  <div class="event-feed">
    <div class="feed-head" @click="toggleExpand">
      <span class="feed-title">最近事件</span>
      <span v-if="myActivity.length" class="feed-count">{{ myActivity.length }} 条</span>
      <span class="feed-spacer" />
      <ChevronDownIcon v-if="expanded" class="feed-arrow" />
      <ChevronRightIcon v-else class="feed-arrow" />
    </div>
    <div v-if="expanded" class="feed-body">
      <div class="feed-toolbar">
        <span class="feed-hint">绿字 = 命中白名单已分发；灰字 = 未命中白名单被丢弃</span>
        <div class="feed-actions">
          <t-button variant="text" size="small" @click="follow = !follow">
            {{ follow ? '暂停跟随' : '恢复跟随' }}
          </t-button>
          <t-button variant="text" size="small" theme="danger" @click="clearAll">
            <template #icon>
              <DeleteIcon class="action-icon" />
            </template>
            清空
          </t-button>
        </div>
      </div>
      <div ref="listEl" class="feed-list">
        <template v-if="myActivity.length">
          <div
            v-for="(entry, i) in myActivity"
            :key="i"
            class="feed-row"
            :class="entry.accepted ? 'feed-row--accepted' : 'feed-row--dropped'"
          >
            <span class="feed-time">{{ formatTime(entry.at) }}</span>
            <span v-if="entry.accepted" class="feed-name">{{ eventLabel(entry.event) }}</span>
            <span class="feed-code">{{ entry.event }}</span>
            <span v-if="!entry.accepted" class="feed-dropped">已丢弃</span>
          </div>
        </template>
        <t-empty v-else description="暂无事件，等待外部软件投递" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ChevronDownIcon, ChevronRightIcon, DeleteIcon } from 'tdesign-icons-vue-next'
import { BuddyEventOptions } from '@common/types/buddyEvent'
import type { SoftwareName } from '@common/types/trafficLight'
import { useIntegrations } from '../useIntegrations'

defineOptions({ name: 'EventFeedPanel' })

const props = defineProps<{ platform: SoftwareName }>()

const { activity, clearActivity } = useIntegrations()

const expanded = ref(false)
const follow = ref(true)
const listEl = ref<HTMLElement | null>(null)

/** 当前平台的事件（卡片内按集成软件过滤，多集成时各看各的） */
const myActivity = computed(() =>
  activity.value.filter((entry) => entry.platform === props.platform)
)

watch(
  () => myActivity.value.length,
  () => {
    if (!expanded.value || !follow.value) return
    nextTick(() => {
      const el = listEl.value
      if (el) el.scrollTop = el.scrollHeight
    })
  }
)

/** 清空全部事件（main 缓冲复位，本地 activity 随 useIntegrations 同步清空） */
async function clearAll(): Promise<void> {
  await clearActivity()
}

function toggleExpand(): void {
  expanded.value = !expanded.value
  if (expanded.value && follow.value) {
    nextTick(() => {
      const el = listEl.value
      if (el) el.scrollTop = el.scrollHeight
    })
  }
}

function eventLabel(event: string): string {
  return BuddyEventOptions.find((opt) => opt.value === event)?.label ?? event
}

function formatTime(at: number): string {
  const d = new Date(at)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(
    d.getMilliseconds()
  ).padStart(3, '0')}`
}
</script>

<style scoped lang="less">
.event-feed {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--td-component-stroke);
}

.feed-head {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;

  .feed-title {
    font: var(--td-font-body-small);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  .feed-count {
    padding: 0 6px;
    border-radius: var(--td-radius-small);
    font: var(--td-font-size-body-small);
    color: var(--td-text-color-secondary);
    background: var(--td-bg-color-secondarycontainer);
  }

  .feed-spacer {
    flex: 1;
  }

  .feed-arrow {
    font-size: var(--td-font-size-body-medium);
    color: var(--td-text-color-placeholder);
  }
}

.feed-body {
  margin-top: 8px;
}

.feed-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;

  .feed-hint {
    font: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }

  .feed-actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;

    .action-icon {
      font-size: var(--td-font-size-body-small);
    }
  }
}

.feed-list {
  max-height: 240px;
  overflow-y: auto;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--td-bg-color-secondarycontainer);
}

.feed-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
  line-height: 1.8;
  font-variant-numeric: tabular-nums;

  .feed-time {
    flex-shrink: 0;
    font-family: var(--td-font-family-code);
  }

  .feed-name {
    flex-shrink: 0;
    font-weight: 600;
  }

  .feed-code {
    font-family: var(--td-font-family-code);
    word-break: break-all;
  }

  .feed-dropped {
    flex-shrink: 0;
  }

  /* 命中白名单整行绿字；未命中整行灰字（已丢弃） */
  &--accepted {
    color: var(--td-success-color-7);
  }

  &--dropped {
    color: var(--td-text-color-placeholder);
  }
}
</style>
