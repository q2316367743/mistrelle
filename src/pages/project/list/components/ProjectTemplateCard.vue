<template>
  <t-card size="small" hover-shadow class="template-card" @click="emit('use')">
    <div class="template-card__icon">
      <file-icon />
    </div>
    <div class="template-card__name">{{ template.name }}</div>
    <div class="template-card__desc">{{ template.description }}</div>
  </t-card>
</template>

<script lang="ts" setup>
import { FileIcon } from 'tdesign-icons-vue-next'
import { ProjectTemplate } from '@/modules/project'

const props = defineProps<{ template: ProjectTemplate }>()
const emit = defineEmits<{ use: [] }>()

</script>

<style scoped lang="less">
.template-card {
  cursor: pointer;

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin-bottom: 10px;
    background: var(--td-bg-color-component);
    border-radius: var(--td-radius-medium);
    color: var(--td-text-color-secondary);
  }

  &__name {
    font: var(--td-font-title-small);
    color: var(--td-text-color-primary);
  }

  &__desc {
    margin-top: 4px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
