<template>
  <t-popup v-model:visible="visible" trigger="click" placement="top-left">
    <div class="l-chat-mode" :class="{ 'is-open': visible }">
      <component :is="active.icon" :class="['l-chat-mode__icon', `is-${active.theme}`]" />
      <span class="l-chat-mode__label">{{ active.label }}</span>
      <chevron-down-icon :class="['l-chat-mode__arrow', { 'is-open': visible }]" />
    </div>
    <template #content>
      <div class="l-chat-mode-panel">
        <div
          v-for="item in CHAT_MODE_OPTIONS"
          :key="item.value"
          :class="['l-chat-mode-panel__item', { 'is-active': item.value === mode }]"
          :title="item.desc"
          @click="handleSelect(item.value)"
        >
          <component :is="item.icon" :class="['l-chat-mode-panel__icon', `is-${item.theme}`]" />
          <div class="l-chat-mode-panel__body">
            <span class="l-chat-mode-panel__title">{{ item.label }}</span>
            <span class="l-chat-mode-panel__desc">{{ item.desc }}</span>
          </div>
          <check-icon v-if="item.value === mode" class="l-chat-mode-panel__check" />
        </div>
      </div>
    </template>
  </t-popup>
</template>
<script lang="ts" setup>
import { CheckIcon, ChevronDownIcon } from 'tdesign-icons-vue-next'
import type { AiChatMode } from '@/entity'
import { CHAT_MODE_OPTIONS, DEFAULT_CHAT_MODE, getChatModeOption } from './chatModeOptions'

/** 当前权限模式（四档互斥单选） */
const mode = defineModel<AiChatMode>({ default: DEFAULT_CHAT_MODE })

const visible = ref(false)

const active = computed(() => getChatModeOption(mode.value))

const handleSelect = (value: AiChatMode) => {
  mode.value = value
  visible.value = false
}
</script>
<style scoped lang="less">
.l-chat-mode {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 8px;
  border-radius: var(--td-radius-medium);
  color: var(--td-text-color-primary);
  font: var(--td-font-body-medium);
  white-space: nowrap;
  user-select: none;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;

  &:hover,
  &.is-open {
    background: var(--td-bg-color-container-hover);
  }

  &__icon {
    font-size: 16px;
  }

  &__label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__arrow {
    font-size: 14px;
    color: var(--td-text-color-placeholder);
    transition: transform 0.2s ease-in-out;

    &.is-open {
      transform: rotate(180deg);
    }
  }
}

.l-chat-mode-panel {
  min-width: 240px;
  padding: 4px;

  &__item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: var(--td-radius-medium);
    cursor: pointer;
    transition: background-color 0.2s ease-in-out;
    margin-bottom: 8px;
    &:last-child {
      margin-bottom: 0;
    }

    &:hover {
      background: var(--td-bg-color-container-hover);
    }

    &.is-active {
      background: var(--td-bg-color-container-hover);
    }
  }

  &__icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  &__body {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    gap: 1px;
  }

  &__title {
    color: var(--td-text-color-primary);
    font: var(--td-font-body-medium);
    font-weight: 500;
  }

  &__desc {
    color: var(--td-text-color-placeholder);
    font: var(--td-font-body-small);
  }

  &__check {
    flex-shrink: 0;
    font-size: 16px;
    color: var(--td-brand-color);
  }
}

/* 主题色：与 tdesign Token 对齐，禁止裸色值 */
.is-default {
  color: var(--td-text-color-secondary);
}

.is-primary {
  color: var(--td-brand-color);
}

.is-success {
  color: var(--td-success-color);
}

.is-warning {
  color: var(--td-warning-color);
}
</style>
