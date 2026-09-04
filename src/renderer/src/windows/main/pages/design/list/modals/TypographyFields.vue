<template>
  <div class="typo-fields">
    <div v-for="group in typoGroups" :key="group.key" class="typo-fields__group">
      <div class="typo-fields__group-title">{{ group.label }}</div>
      <t-form class="typo-fields__form">
        <div class="typo-fields__grid">
          <t-form-item label="字体" class="typo-fields__font-item">
            <t-select
              v-model="typography[group.key].font"
              filterable
              creatable
              clearable
              :loading="loadingFonts"
              placeholder="选择或输入字体名"
            >
              <t-option-group
                v-for="fontGroup in fontGroups"
                :key="fontGroup.label"
                :label="fontGroup.label"
              >
                <t-option
                  v-for="f in fontGroup.items"
                  :key="f.name"
                  :value="f.name"
                  :label="f.name"
                  :disabled="fontGroup.disabled"
                >
                  <div class="typo-fields__font-option">
                    <font-preview-text :font="f" class="typo-fields__font-preview" />
                    <span class="typo-fields__font-name">{{ f.name }}</span>
                  </div>
                </t-option>
              </t-option-group>
            </t-select>
          </t-form-item>
          <t-form-item label="字重">
            <t-input-number
              v-model="typography[group.key].weight"
              :min="100"
              :max="900"
              :step="100"
            />
          </t-form-item>
          <t-form-item label="字号 (px)">
            <t-input-number v-model="typography[group.key].size" :min="8" :max="200" />
          </t-form-item>
          <t-form-item label="行高">
            <t-input-number
              v-model="typography[group.key].lineHeight"
              :min="1"
              :max="3"
              :step="0.05"
            />
          </t-form-item>
        </div>
      </t-form>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { AiDesignStyleTypography } from '@/entity'
import FontPreviewText from '@/components/FontPreviewText.vue'
import { FontItem } from '@/domain/FontItem'
import { useAuthStore } from '@/windows/main/store'

defineProps<{ typography: AiDesignStyleTypography }>()

const typoGroups: Array<{ key: keyof AiDesignStyleTypography; label: string }> = [
  { key: 'heading', label: '标题 Heading' },
  { key: 'body', label: '正文 Body' },
  { key: 'caption', label: '辅助 Caption' }
]

/**
 * 字体数据源：window.preload.font.listFonts()（统一契约见 types/font.d.ts，
 * 返回系统 + 资源库字体，资源库同名覆盖系统），按来源分组展示。
 * 资源库字体（自定义字体）为会员功能：非会员可见但锁定选择。
 */
const fonts = ref<FontItem[]>([])
const loadingFonts = ref(true)

const fontGroups = computed(() => {
  const fontsLocked = !useAuthStore().features.customFonts
  return [
    { label: '系统字体', items: fonts.value.filter((f) => f.source === 'system'), disabled: false },
    {
      label: fontsLocked ? '资源库字体（会员）' : '资源库字体',
      items: fonts.value.filter((f) => f.source === 'library'),
      disabled: fontsLocked
    }
  ]
})

onMounted(async () => {
  try {
    fonts.value = await window.preload.font.listFonts()
  } finally {
    loadingFonts.value = false
  }
})
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

  &__font-item {
    grid-column: 1 / -1;
  }

  &__font-option {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-width: 0;
  }

  &__font-preview {
    flex: 1;
    min-width: 0;
    font-size: 14px;
  }

  &__font-name {
    flex: none;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
