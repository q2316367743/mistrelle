<template>
  <section class="setting-card">
    <div class="setting-row">
      <t-icon name="system-sum" class="setting-row__icon" />
      <div class="setting-row__meta">
        <div class="setting-row__title">记忆模型</div>
        <div class="setting-row__desc">提取与整理记忆时使用的模型，未配置则无法生成记忆</div>
      </div>
      <t-select
        class="setting-row__control"
        :value="modelValue"
        :options="options"
        :disabled="!enabled"
        placeholder="请选择记忆模型"
        clearable
        filterable
        @change="onModelChange"
      />
    </div>

    <div class="setting-row">
      <t-icon name="cloud-download" class="setting-row__icon" />
      <div class="setting-row__meta">
        <div class="setting-row__title">立即提取短期记忆</div>
        <div class="setting-row__desc">
          立即提取所有未提取完的会话记忆到当日文件（通常在一轮回复结束 5 分钟后自动执行）
        </div>
      </div>
      <t-button
        class="setting-row__action"
        theme="default"
        variant="outline"
        :loading="extracting"
        :disabled="!enabled || !modelReady"
        @click="emit('extract')"
      >
        立即提取
      </t-button>
    </div>

    <div class="setting-row">
      <t-icon name="filter-sort" class="setting-row__icon" />
      <div class="setting-row__meta">
        <div class="setting-row__title">立即整理</div>
        <div class="setting-row__desc">{{ consolidateDesc }}</div>
      </div>
      <t-button
        class="setting-row__action"
        theme="default"
        variant="outline"
        :loading="consolidating"
        :disabled="!enabled || !modelReady"
        @click="emit('consolidate')"
      >
        立即整理
      </t-button>
    </div>
  </section>
</template>
<script lang="ts" setup>
import type { SelectOptionGroup, SelectValue } from 'tdesign-vue-next'

defineProps<{
  /** 记忆模型 key（SettingDefault.defaultSummaryModel） */
  modelValue: string
  options: Array<SelectOptionGroup>
  enabled: boolean
  /** 记忆模型是否已配置（与 memoryChatCompletion 同源，无兜底） */
  modelReady: boolean
  extracting: boolean
  consolidating: boolean
  consolidateDesc: string
}>()

const emit = defineEmits<{
  'update:modelValue': [string]
  extract: []
  consolidate: []
}>()

/** 清空时 tdesign 回调可能给出 undefined / number，统一归一为空串保持 string 契约 */
const onModelChange = (value: SelectValue): void => {
  emit('update:modelValue', typeof value === 'string' ? value : '')
}
</script>
<style scoped lang="less">
.setting-card {
  background: var(--fluent-card-bg);
  border: 1px solid var(--fluent-card-border);
  border-radius: var(--fluent-radius-card);
  box-shadow: var(--fluent-elevation-1);
  overflow: hidden;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  transition: background-color var(--fluent-transition-fast);

  & + & {
    border-top: 1px solid var(--td-component-stroke);
  }

  &:hover {
    background: var(--fluent-item-hover);
  }

  &__icon {
    flex: none;
    font-size: 20px;
    color: var(--td-brand-color);
  }

  &__meta {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font: var(--td-font-body-large);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__desc {
    margin-top: 2px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  &__control {
    flex: none;
    width: 360px;
  }

  &__action {
    flex: none;
  }
}

@media (max-width: 640px) {
  .setting-row {
    flex-wrap: wrap;
  }

  .setting-row__control {
    width: 100%;
  }
}
</style>
