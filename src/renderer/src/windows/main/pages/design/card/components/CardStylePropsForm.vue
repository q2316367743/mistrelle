<template>
  <div class="props-form">
    <div v-for="group in groups" :key="group.value" class="props-form__group">
      <h4 class="props-form__group-title">{{ group.label }}</h4>
      <div class="props-form__grid">
        <card-style-prop-field
          v-for="prop in group.props"
          :key="prop.key"
          :prop="prop"
          :value="modelValue[prop.key] ?? ''"
          @update="(v: string) => update(prop.key, v)"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import {
  CARD_STYLE_GROUP_OPTIONS,
  CARD_STYLE_PROPS,
  type CardStylePropGroup
} from '@/global/card-style-props'
import CardStylePropField from './CardStylePropField.vue'

/**
 * 卡片样式键值对编辑表单：分组与控件全部由注册表（CARD_STYLE_PROPS）驱动，
 * 注册表新增属性后此处自动出现对应编辑项，无需改动。
 */
const props = defineProps<{ modelValue: Record<string, string> }>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, string>] }>()

const groups = computed(() =>
  CARD_STYLE_GROUP_OPTIONS.map((g) => ({
    ...g,
    props: CARD_STYLE_PROPS.filter((p) => p.group === (g.value as CardStylePropGroup))
  })).filter((g) => g.props.length > 0)
)

const update = (key: string, value: string) =>
  emit('update:modelValue', { ...props.modelValue, [key]: value })
</script>

<style scoped lang="less">
.props-form {
  &__group {
    & + & {
      margin-top: 20px;
    }
  }

  &__group-title {
    margin: 0 0 10px;
    font-size: 14px;
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 16px;
  }
}
</style>
