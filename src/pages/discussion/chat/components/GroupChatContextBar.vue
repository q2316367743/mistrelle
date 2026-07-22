<template>
  <t-popup placement="bottom-right" trigger="click" :overlay-inner-style="panelPopupStyle">
    <div class="group-context-bar__trigger" :class="{ 'is-expired': expired }" title="公共上下文：所有成员被问到时都会注入的同一份内容">
      <span class="group-context-bar__token">{{ tokenLabel }}</span>
      <span class="group-context-bar__hint">上下文</span>
    </div>
    <template #content>
      <div class="group-context-bar__panel">
        <div class="group-context-bar__panel-title">公共上下文</div>
        <div class="group-context-bar__token-big">{{ tokenLabel }} tokens</div>
        <div class="group-context-bar__row">
          <span class="group-context-bar__label">状态</span>
          <span class="group-context-bar__value" :class="expired ? 'is-expired' : 'is-active'">
            {{ expired ? '已过期' : `剩余 ${remainingLabel}` }}
          </span>
        </div>
        <div class="group-context-bar__row">
          <span class="group-context-bar__label">过期</span>
          <div class="group-context-bar__expiry">
            <t-input-number
              :value="chat?.contextExpiryHours"
              :min="1"
              :max="168"
              :step="1"
              size="small"
              theme="column"
              @change="handleExpiryChange"
            />
            <span class="group-context-bar__expiry-unit">小时</span>
          </div>
        </div>
        <div class="group-context-bar__actions">
          <t-button variant="outline" size="small" :disabled="compressing" @click="emit('new-context')">
            新上下文
          </t-button>
          <t-button theme="primary" variant="outline" size="small" :loading="compressing" @click="emit('compress')">
            压缩
          </t-button>
        </div>
        <div class="group-context-bar__danger-actions">
          <t-button variant="outline" size="small" @click="emit('clear-log')">
            清空记录
          </t-button>
          <t-button theme="danger" variant="outline" size="small" @click="emit('clear-cache')">
            清空缓存
          </t-button>
        </div>
      </div>
    </template>
  </t-popup>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { AiDiscussion, AiGroupChat } from '@/entity/ai'
import { buildPublicContext, estimateTokens } from '@/modules/discussion/GroupChatEngine'

const props = defineProps<{
  chat?: AiGroupChat
  discussion?: AiDiscussion
  compressing: boolean
}>()

const emit = defineEmits<{
  'new-context': []
  compress: []
  'update-expiry': [hours: number]
  'clear-log': []
  'clear-cache': []
}>()

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const activeContext = computed(() => {
  const chat = props.chat
  if (!chat) return undefined
  return chat.contexts.find((c) => c.id === chat.activeContextId)
})

const windowMs = computed(() => (props.chat ? props.chat.contextExpiryHours * 3600 * 1000 : 0))

const remainingMs = computed(() => {
  const ctx = activeContext.value
  if (!ctx || !props.chat) return 0
  return windowMs.value - (now.value - ctx.lastActivityAt)
})

const expired = computed(() => remainingMs.value <= 0)

/** 当前公共上下文的 token 估算（与真正注入给每个成员的文本一致） */
const contextTokens = computed(() => {
  if (!props.chat || !props.discussion) return 0
  return estimateTokens(buildPublicContext(props.discussion, props.chat))
})

const formatTokens = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return `${value}`
}

const tokenLabel = computed(() => formatTokens(contextTokens.value))

const remainingLabel = computed(() => {
  const ms = Math.max(0, remainingMs.value)
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
})

const panelPopupStyle: Record<string, string> = { width: '260px' }

const handleExpiryChange = (value: number | string) => {
  const hours = typeof value === 'string' ? Number(value) : value
  if (Number.isFinite(hours) && hours > 0) emit('update-expiry', hours)
}
</script>

<style scoped lang="less">
.group-context-bar__trigger {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--td-radius-medium);
  border: 1px solid var(--td-component-border);
  background: var(--td-bg-color-container);
  cursor: pointer;
  transition: border-color 0.2s, opacity 0.2s;

  &:hover {
    border-color: var(--td-brand-color);
  }

  &.is-expired {
    border-color: var(--td-error-color);
  }
}

.group-context-bar__token {
  color: var(--td-text-color-primary);
  font: var(--td-font-title-small);
  font-variant-numeric: tabular-nums;

  .group-context-bar__trigger.is-expired & {
    color: var(--td-error-color);
  }
}

.group-context-bar__hint {
  color: var(--td-text-color-placeholder);
  font: var(--td-font-body-small);
}

.group-context-bar__panel {
  display: flex;
  flex-direction: column;
  gap: var(--td-comp-margin-m);
  padding: 4px;
}

.group-context-bar__panel-title {
  color: var(--td-text-color-primary);
  font: var(--td-font-title-small);
}

.group-context-bar__token-big {
  color: var(--td-brand-color);
  font: var(--td-font-title-medium);
  font-variant-numeric: tabular-nums;
}

.group-context-bar__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--td-comp-margin-m);
}

.group-context-bar__label {
  color: var(--td-text-color-secondary);
  font: var(--td-font-body-small);
}

.group-context-bar__value {
  color: var(--td-text-color-primary);
  font: var(--td-font-body-medium);

  &.is-expired {
    color: var(--td-error-color);
  }

  &.is-active {
    color: var(--td-brand-color);
  }
}

.group-context-bar__expiry {
  display: flex;
  align-items: center;
  gap: 4px;
}

.group-context-bar__expiry-unit {
  color: var(--td-text-color-placeholder);
  font: var(--td-font-body-small);
}

.group-context-bar__actions {
  display: flex;
  gap: var(--td-comp-margin-s);
}

.group-context-bar__danger-actions {
  display: flex;
  gap: var(--td-comp-margin-s);
  margin-top: var(--td-comp-margin-s);
  padding-top: var(--td-comp-margin-s);
  border-top: 1px solid var(--td-border-level-1-color);
}
</style>
