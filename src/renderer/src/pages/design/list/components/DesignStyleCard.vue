<template>
  <t-card size="small" hover-shadow class="style-card" @click="emit('open')">
    <div class="style-card__palette" :title="paletteTitle">
      <span
        v-for="c in paletteColors"
        :key="c.label"
        class="style-card__swatch"
        :style="{ background: c.value }"
      />
    </div>
    <div class="style-card__head">
      <div class="style-card__name" :title="style.name">
        {{ style.name }}
        <t-tag v-if="isSystem" theme="primary" variant="light" size="small">内置</t-tag>
      </div>
      <t-dropdown :popup-props="{ trigger: 'click' }" @click.stop>
        <t-button
          theme="primary"
          variant="text"
          shape="square"
          size="small"
          @click.stop
        >
          <template #icon><MoreIcon /></template>
        </t-button>
        <t-dropdown-menu>
          <t-dropdown-item @click="emit('open')">
            <template #prefix-icon><ViewListIcon /></template>
            查看
          </t-dropdown-item>
          <t-dropdown-item v-if="!isSystem" @click="emit('edit')">
            <template #prefix-icon><EditIcon /></template>
            编辑
          </t-dropdown-item>
          <t-dropdown-item v-if="!isSystem" @click="emit('delete')">
            <template #prefix-icon><DeleteIcon class="color-red" /></template>
            <span class="color-red">删除</span>
          </t-dropdown-item>
        </t-dropdown-menu>
      </t-dropdown>
    </div>
    <div class="style-card__desc">{{ style.description }}</div>
    <div class="style-card__meta">
      <t-tag size="small" variant="outline">{{ categoryLabel }}</t-tag>
      <span v-for="t in style.tags.slice(0, 3)" :key="t" class="style-card__tag">#{{ t }}</span>
    </div>
  </t-card>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { MoreIcon, EditIcon, DeleteIcon, ViewListIcon } from 'tdesign-icons-vue-next'
import {
  AiDesignStyle,
  AiDesignStyleItem,
  getDesignStyleCategoryLabel,
  normalizeDesignStyleCategory
} from '@/entity'

const props = defineProps<{ style: AiDesignStyleItem | AiDesignStyle }>()
const emit = defineEmits<{ open: []; edit: []; delete: [] }>()

/** 内置预设不可编辑 / 删除 */
const isSystem = computed(() => 'isSystem' in props.style && props.style.isSystem)

const paletteColors = computed(() => {
  const p = props.style.colorPalette
  return [
    { label: '主色', value: p.primary },
    { label: '辅助色', value: p.secondary },
    { label: '背景色', value: p.background },
    { label: '表面色', value: p.surface },
    { label: '主文字', value: p.text_primary },
    { label: '次文字', value: p.text_secondary }
  ]
})

const paletteTitle = computed(() =>
  paletteColors.value.map((c) => `${c.label} ${c.value}`).join(' · ')
)

const categoryLabel = computed(() =>
  getDesignStyleCategoryLabel(normalizeDesignStyleCategory(props.style.category))
)
</script>

<style scoped lang="less">
.style-card {
  cursor: pointer;

  &__palette {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
  }

  &__swatch {
    width: 22px;
    height: 22px;
    border-radius: var(--td-radius-default);
    border: 1px solid var(--td-component-stroke);
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  &__name {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
    font: var(--td-font-title-small);
    color: var(--td-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__desc {
    margin-top: 6px;
    height: 40px;
    overflow: hidden;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    min-height: 22px;
  }

  &__tag {
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
