<template>
  <div class="palette-block">
    <div class="palette-block__strip">
      <span
        v-for="c in paletteColors"
        :key="c.label"
        class="palette-block__seg"
        :style="{ background: c.value }"
        :title="`${c.label} ${c.value}`"
      />
    </div>
    <div class="palette-block__grid">
      <div v-for="c in paletteColors" :key="c.label" class="palette-block__item">
        <span class="palette-block__dot" :style="{ background: c.value }" />
        <span class="palette-block__label">{{ c.label }}</span>
        <span class="palette-block__hex">{{ c.value }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { AiDesignStyleColorPalette } from '@/entity'

const props = defineProps<{ palette: AiDesignStyleColorPalette }>()

const paletteColors = computed(() => {
  const p = props.palette
  return [
    { label: '主色', value: p.primary },
    { label: '辅助色', value: p.secondary },
    { label: '背景色', value: p.background },
    { label: '表面色', value: p.surface },
    { label: '主文字', value: p.text_primary },
    { label: '次文字', value: p.text_secondary }
  ]
})
</script>

<style scoped lang="less">
.palette-block {
  &__strip {
    display: flex;
    height: 48px;
    margin-bottom: 16px;
    border: 1px solid var(--td-component-stroke);
    border-radius: var(--td-radius-default);
    overflow: hidden;
  }

  &__seg {
    flex: 1;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;

    @media (max-width: 720px) {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__dot {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    border: 1px solid var(--td-component-stroke);
    border-radius: var(--td-radius-default);
  }

  &__label {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
  }

  &__hex {
    margin-left: auto;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
