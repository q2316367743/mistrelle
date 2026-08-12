<template>
  <div class="typo-fields">
    <div v-for="group in typoGroups" :key="group.key" class="typo-fields__group">
      <div class="typo-fields__group-title">{{ group.label }}</div>
      <t-form class="typo-fields__form">
        <div class="typo-fields__grid">
          <t-form-item label="字体">
            <t-input v-model="typography[group.key].font" placeholder="如 SF Pro, system-ui" />
          </t-form-item>
          <t-form-item label="字重">
            <t-input-number v-model="typography[group.key].weight" :min="100" :max="900" :step="100" />
          </t-form-item>
          <t-form-item label="字号 (px)">
            <t-input-number v-model="typography[group.key].size" :min="8" :max="200" />
          </t-form-item>
          <t-form-item label="行高">
            <t-input-number v-model="typography[group.key].lineHeight" :min="1" :max="3" :step="0.05" />
          </t-form-item>
        </div>
      </t-form>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { AiDesignStyleTypography } from '@/entity'

defineProps<{ typography: AiDesignStyleTypography }>()

const typoGroups: Array<{ key: keyof AiDesignStyleTypography; label: string }> = [
  { key: 'heading', label: '标题 Heading' },
  { key: 'body', label: '正文 Body' },
  { key: 'caption', label: '辅助 Caption' }
]
</script>

<style scoped lang="less">
.typo-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;

  &__group-title {
    margin-bottom: 8px;
    font: var(--td-font-title-small);
    color: var(--td-text-color-primary);
  }

  &__form {
    max-width: 560px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0 16px;
  }
}
</style>
