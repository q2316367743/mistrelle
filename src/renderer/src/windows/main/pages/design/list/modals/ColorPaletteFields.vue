<template>
  <t-form class="palette-fields__form">
    <t-form-item v-for="item in paletteItems" :key="item.key" :label="item.label">
      <div class="palette-fields__row">
        <t-color-picker v-model="palette[item.key]" format="HEX" />
        <span class="palette-fields__hex">{{ palette[item.key] }}</span>
      </div>
    </t-form-item>
  </t-form>
</template>

<script lang="ts" setup>
import { AiDesignStyleColorPalette } from '@/entity'

defineProps<{ palette: AiDesignStyleColorPalette }>()

const paletteItems: Array<{ key: keyof AiDesignStyleColorPalette; label: string }> = [
  { key: 'primary', label: '主色' },
  { key: 'secondary', label: '辅助色' },
  { key: 'background', label: '背景色' },
  { key: 'surface', label: '表面色' },
  { key: 'text_primary', label: '主文字色' },
  { key: 'text_secondary', label: '次文字色' }
]
</script>

<style scoped lang="less">
.palette-fields {
  &__form {
    padding-top: 8px;
    max-width: 560px;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__hex {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-secondary);
  }
}
</style>
