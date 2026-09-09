<template>
  <div class="integration-panel">
    <div class="head">
      <div class="title-area">
        <span class="name">{{ item.label }}</span>
        <t-tag :theme="statusTheme" size="small" variant="light">{{ statusLabel }}</t-tag>
      </div>
      <t-button
        v-if="status !== 'ready'"
        size="small"
        variant="outline"
        :loading="installing"
        @click="installNow"
      >
        {{ status === 'outdated' ? '更新' : '安装' }}
      </t-button>
    </div>
    <div class="desc">{{ item.description }}</div>
    <div class="install-status" :data-status="status">{{ statusText }}</div>
    <div class="meta">
      <span class="meta-label">安装位置</span>
      <span class="meta-value mono">{{ statusDetail?.path || '—' }}</span>
    </div>
    <div class="events">
      <div class="events-title">支持事件（{{ item.events.length }} 个）</div>
      <div v-for="group in eventGroups" :key="group.title" class="event-group">
        <span class="group-title">{{ group.title }}</span>
        <div class="chips">
          <t-tag v-for="event in group.events" :key="event" size="small" variant="outline">
            {{ eventLabel(event) }}
          </t-tag>
        </div>
      </div>
    </div>
    <permission-request-panel :source="item.name" />
    <event-feed-panel :platform="item.name" />
    <div class="hint">{{ item.effectHint }}</div>
  </div>
</template>

<script lang="ts" setup>
import type { PlatformConfigStatus, PlatformStatus } from '@common/types/integrations'
import { PlatformConfigStatusOptions } from '@common/types/integrations'
import {
  BuddyEventOptions,
  BUDDY_EVENT_GROUPS,
  type BuddyEventName
} from '@common/types/buddyEvent'
import type { IntegrationItem } from '../registry'
import { useIntegrations } from '../useIntegrations'
import EventFeedPanel from './EventFeedPanel.vue'
import PermissionRequestPanel from './PermissionRequestPanel.vue'

defineOptions({ name: 'IntegrationPanel' })

const props = defineProps<{ item: IntegrationItem }>()

const { statuses, install } = useIntegrations()

const installing = ref(false)

/** 接入配置状态（未检测 = 未安装） */
const status = computed<PlatformConfigStatus>(
  () => statuses.value[props.item.name]?.status ?? 'missing'
)
const statusDetail = computed<PlatformStatus | null>(() => statuses.value[props.item.name] ?? null)

const statusLabel = computed(
  () => PlatformConfigStatusOptions.find((opt) => opt.value === status.value)?.label ?? status.value
)
const statusTheme = computed(() =>
  status.value === 'ready' ? 'success' : status.value === 'outdated' ? 'warning' : 'default'
)

/** 各安装态的说明文案 */
const STATUS_TEXT: Record<PlatformConfigStatus, string> = {
  missing: '接入配置未安装，安装后事件才会投递到 mistrelle',
  outdated: '接入配置有更新，建议更新以保持事件上报正常',
  ready: '接入配置已安装，事件正常投递'
}
const statusText = computed(() => STATUS_TEXT[status.value])

/** 安装/更新内置插件（成功提示与状态刷新在 useIntegrations 内） */
async function installNow(): Promise<void> {
  installing.value = true
  try {
    await install(props.item.name)
  } finally {
    installing.value = false
  }
}

/** 登记的事件按 Buddy 事件分组展示（过滤掉不在该软件支持集内的事件） */
const eventGroups = computed(() =>
  BUDDY_EVENT_GROUPS.map((group) => ({
    title: group.title,
    events: group.events.filter((event) => props.item.events.includes(event))
  })).filter((group) => group.events.length > 0)
)

function eventLabel(event: BuddyEventName): string {
  return BuddyEventOptions.find((opt) => opt.value === event)?.label ?? event
}
</script>

<style scoped lang="less">
.integration-panel {
  padding: 16px;
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container);
  margin-top: 16px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  .title-area {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .name {
    font: var(--td-font-body-large);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }
}

.desc {
  margin-top: 4px;
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
}

.install-status {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font: var(--td-font-body-small);
  color: var(--td-text-color-secondary);
  background: var(--td-bg-color-secondarycontainer);

  &[data-status='ready'] {
    color: var(--td-success-color-7);
  }

  &[data-status='outdated'] {
    color: var(--td-warning-color-7);
  }
}

.meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 8px;

  .meta-label {
    flex-shrink: 0;
    font: var(--td-font-body-small);
    color: var(--td-text-color-tertiary);
  }

  .meta-value {
    font: var(--td-font-body-small);
    color: var(--td-text-color-primary);
    word-break: break-all;

    &.mono {
      font-family: var(--td-font-family-code);
      font-size: var(--td-font-size-body-small);
      color: var(--td-text-color-secondary);
    }
  }
}

.events {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--td-component-stroke);

  .events-title {
    margin-bottom: 8px;
    font: var(--td-font-body-small);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  .event-group {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 4px 0;

    .group-title {
      flex-shrink: 0;
      width: 32px;
      font: var(--td-font-body-small);
      color: var(--td-text-color-tertiary);
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  }
}

.hint {
  margin-top: 8px;
  font: var(--td-font-body-small);
  color: var(--td-text-color-placeholder);
}
</style>
