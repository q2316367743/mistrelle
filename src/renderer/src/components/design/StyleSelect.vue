<template>
  <t-select
    v-model="modelValue"
    clearable
    filterable
    :placeholder="placeholder"
    :popup-props="{ overlayClassName: 'style-select-overlay' }"
  >
    <t-option-group v-for="group in groups" :key="group.category" :label="group.label">
      <t-option
        v-for="s in group.items"
        :key="s.id"
        :value="s.id"
        :label="s.name"
        :disabled="!s.isSystem && stylesLocked"
      >
        <t-popup
          trigger="hover"
          placement="right-top"
          :show-arrow="false"
          :delay="[120, 100]"
          :overlay-inner-style="{ padding: '0' }"
        >
          <div class="style-select__option">
            <span class="style-select__option-name">
              {{ s.name }}
              <t-tag v-if="s.isSystem" theme="primary" variant="light" size="small">内置</t-tag>
            </span>
            <span class="style-select__option-desc">{{ s.description }}</span>
          </div>
          <template #content>
            <div class="style-select__preview">
              <style-card-face :style="s" variant="compact" :scale="0.5" />
            </div>
          </template>
        </t-popup>
      </t-option>
    </t-option-group>
  </t-select>
</template>
<script lang="ts" setup>
import { groupDesignStylesByCategory } from '@/entity'
import { useAuthStore, useDesignStyleStore } from '@/store'
import StyleCardFace from './StyleCardFace.vue'

withDefaults(
  defineProps<{
    /** 下拉占位文案 */
    placeholder?: string
  }>(),
  { placeholder: '选择设计风格（可选）' }
)

/** 选中的设计风格 id（'' = 未选） */
const modelValue = defineModel<string>({ default: '' })

const designStyleStore = useDesignStyleStore()
/** 自定义设计风格为会员功能：非会员在下拉中可见但锁定选择 */
const stylesLocked = computed(() => !useAuthStore().features.extendedDesignStyles)
/** 按分组聚合的设计风格选项（预设 + 用户自建） */
const groups = computed(() =>
  groupDesignStylesByCategory(
    designStyleStore.all.map((s) => ({
      ...s,
      isSystem: 'isSystem' in s && s.isSystem
    }))
  )
)
</script>
<style scoped lang="less">
.style-select__option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 0;
}

.style-select__option-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--td-font-size-body-medium);
  color: var(--td-text-color-primary);
}

.style-select__option-desc {
  font-size: var(--td-font-size-body-small);
  color: var(--td-text-color-secondary);
}

.style-select__preview {
  width: 300px;
  padding: 8px;
}
</style>
<style lang="less">
/* 下拉面板 teleport 到 body，需全局样式撑高选项放预览卡（类名见 popup-props.overlayClassName） */
.style-select-overlay {
  .t-select-option {
    height: 100%;
    padding: 8px;
  }
}
</style>
