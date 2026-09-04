<template>
  <div class="prompt-block">
    <div class="prompt-block__item">
      <div class="prompt-block__label">正向风格描述词</div>
      <pre class="prompt-block__content">{{ visualPrompt || '未填写' }}</pre>
    </div>
    <div class="prompt-block__item">
      <div class="prompt-block__label">反向排除词</div>
      <pre class="prompt-block__content prompt-block__content--muted">{{ negativePrompt || '未填写' }}</pre>
    </div>
  </div>
</template>

<script lang="ts" setup>
defineProps<{ visualPrompt: string; negativePrompt: string }>()
</script>

<style scoped lang="less">
.prompt-block {
  &__item + &__item {
    margin-top: 16px;
  }

  &__label {
    margin-bottom: 8px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__content {
    margin: 0;
    padding: 12px;
    font: var(--td-font-body-medium);
    line-height: 1.6;
    color: var(--td-text-color-primary);
    background: var(--td-bg-color-component);
    border-radius: var(--td-radius-default);
    white-space: pre-wrap;
    word-break: break-word;

    &--muted {
      color: var(--td-text-color-secondary);
    }
  }
}
</style>
