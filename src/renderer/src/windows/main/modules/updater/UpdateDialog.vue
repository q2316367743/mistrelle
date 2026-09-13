<template>
  <div class="update-overlay" @click.self="emit('cancel')">
    <div class="update-card" role="dialog" aria-modal="true" aria-label="应用更新">
      <button class="close-btn" type="button" aria-label="关闭" @click="emit('cancel')">
        <close-icon />
      </button>
      <h2 class="title">应用更新</h2>
      <div class="version-row">
        <span class="version-pill">v{{ state.currentVersion }}</span>
        <arrow-right-icon class="arrow" />
        <span class="version-pill target">v{{ state.availableVersion }}</span>
      </div>
      <template v-if="state.releaseNotes">
        <div class="section-label">更新日志</div>
        <div class="notes">{{ state.releaseNotes }}</div>
      </template>
      <div v-else-if="state.mode === 'external'" class="section-label plain">
        新版本通过网盘分发，点击「下载」前往获取。
      </div>
      <div class="actions">
        <button class="btn subtle" type="button" @click="emit('cancel')">暂不</button>
        <button class="btn primary" type="button" @click="emit('confirm')">
          {{ state.mode === 'external' ? '下载' : '立即更新' }}
        </button>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { onMounted, onUnmounted } from 'vue'
import { ArrowRightIcon, CloseIcon } from 'tdesign-icons-vue-next'

defineProps<{ state: UpdaterState }>()
const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('cancel')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>
<style scoped lang="less">
.update-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: var(--fluent-acrylic-blur);
}

.update-card {
  position: relative;
  width: 480px;
  max-width: calc(100vw - 48px);
  padding: 24px;
  border: 1px solid var(--fluent-card-border);
  border-radius: var(--fluent-radius-large);
  background: var(--fluent-card-bg);
  backdrop-filter: var(--fluent-acrylic-blur);
  box-shadow: var(--fluent-elevation-4);
  color: var(--td-text-color-primary);
  animation: card-in var(--fluent-transition-normal) cubic-bezier(0.1, 0.9, 0.2, 1);
}

@keyframes card-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--fluent-radius-smooth);
  background: transparent;
  color: var(--td-text-color-secondary);
  font-size: 16px;
  cursor: pointer;
  transition: background-color var(--fluent-transition-fast);

  &:hover {
    background: var(--fluent-item-hover);
  }
}

.title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.version-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  font-variant-numeric: tabular-nums;

  .arrow {
    color: var(--td-text-color-placeholder);
    font-size: 16px;
  }
}

.version-pill {
  padding: 4px 12px;
  border-radius: var(--fluent-radius-round);
  background: var(--fluent-item-hover);
  font-size: 13px;

  &.target {
    background: var(--fluent-item-selected);
    color: var(--fluent-accent-color);
    font-weight: 600;
  }
}

.section-label {
  margin-top: 20px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--td-text-color-secondary);

  &.plain {
    margin-top: 16px;
    font-size: 13px;
    font-weight: 400;
    letter-spacing: normal;
    line-height: 1.6;
  }
}

.notes {
  max-height: 200px;
  margin-top: 8px;
  padding: 12px 14px;
  border: 1px solid var(--fluent-card-border);
  border-radius: var(--fluent-radius-card);
  background: var(--fluent-item-hover);
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-y: auto;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}

.btn {
  min-width: 96px;
  padding: 7px 16px;
  border: none;
  border-radius: var(--fluent-radius-smooth);
  font-size: 13px;
  cursor: pointer;
  transition:
    background-color var(--fluent-transition-fast),
    box-shadow var(--fluent-transition-fast);

  &.subtle {
    background: var(--fluent-item-hover);
    color: var(--td-text-color-primary);

    &:hover {
      background: var(--fluent-reveal-bg);
    }
  }

  &.primary {
    background: var(--fluent-accent-color);
    color: #fff;

    &:hover {
      background: var(--td-brand-color-8);
    }
  }

  &:focus-visible {
    box-shadow: var(--fluent-focus-ring);
    outline: none;
  }
}
</style>
