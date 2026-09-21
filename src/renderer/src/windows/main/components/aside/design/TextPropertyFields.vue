<template>
  <div class="text-property-fields">
    <div class="text-property-fields__title">文字</div>
    <t-form label-align="top" class="text-property-fields__form">
      <t-form-item label="文字内容">
        <t-textarea
          v-model="draft.text"
          :autosize="{ minRows: 2, maxRows: 6 }"
          placeholder="输入文字内容"
        />
      </t-form-item>
      <t-form-item label="字体">
        <t-select
          v-model="draft.fontFamily"
          filterable
          :loading="loadingFonts"
          placeholder="选择字体"
        >
          <t-option-group v-for="group in fontGroups" :key="group.label" :label="group.label">
            <t-option
              v-for="f in group.items"
              :key="`${group.label}-${f.name}`"
              :value="f.name"
              :label="f.name"
              :disabled="group.disabled"
            >
              <div class="text-property-fields__font-option">
                <font-preview-text :font="f" class="text-property-fields__font-preview" />
                <span class="text-property-fields__font-name">{{ f.name }}</span>
              </div>
            </t-option>
          </t-option-group>
        </t-select>
      </t-form-item>
      <t-form-item label="字号 (px)">
        <t-input-number v-model="draft.fontSize" :min="8" />
      </t-form-item>
      <t-form-item label="字重">
        <t-select v-model="weightNum" :options="weightOptions" placeholder="选择字重" />
      </t-form-item>
      <t-form-item label="行高">
        <t-input-number
          v-if="draft.lineHeight !== 'AUTO'"
          v-model="lineHeightNum"
          :min="0.1"
          :step="0.1"
          placeholder="默认"
        />
        <t-input v-else value="自动" disabled />
      </t-form-item>
      <t-form-item label="字间距 (px)">
        <t-input-number v-model="draft.letterSpacing" :min="-20" :step="0.1" />
      </t-form-item>
      <t-form-item label="对齐方式">
        <t-select v-model="draft.textAlign" :options="alignOptions" placeholder="默认" />
      </t-form-item>
      <t-form-item label="大小写">
        <t-select v-model="draft.textCase" :options="caseOptions" placeholder="默认" />
      </t-form-item>
      <t-form-item label="斜体">
        <t-switch v-model="draft.italic" />
      </t-form-item>
    </t-form>
  </div>
</template>
<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import FontPreviewText from '@/components/FontPreviewText.vue'
import type { FontItem } from '@/domain/FontItem'
import { useAuthStore } from '@/windows/main/store'
import type { PropertyDraft } from './usePropertyDraft'

const props = defineProps<{
  /** 属性面板本地草稿（编辑不落盘，由面板「保存」统一提交） */
  draft: PropertyDraft
}>()

/** 字重统一按数字档位编辑（节点可能存 "700" 字符串，仅做展示转换） */
const weightNum = computed({
  get: () => (typeof props.draft.fontWeight === 'number' ? props.draft.fontWeight : undefined),
  set: (v: unknown) => {
    props.draft.fontWeight = typeof v === 'number' ? v : undefined
  }
})

/** 行高数值代理：清空视为删除属性 */
const lineHeightNum = computed({
  get: () => (typeof props.draft.lineHeight === 'number' ? props.draft.lineHeight : undefined),
  set: (v: unknown) => {
    props.draft.lineHeight = typeof v === 'number' ? v : undefined
  }
})

const weightOptions = [100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => ({
  label: String(w),
  value: w
}))

const alignOptions = [
  { label: '左对齐', value: 'left' },
  { label: '居中', value: 'center' },
  { label: '右对齐', value: 'right' }
]

const caseOptions = [
  { label: '原样', value: 'none' },
  { label: '大写', value: 'upper' },
  { label: '小写', value: 'lower' }
]

/** 字体数据源（模块级缓存，避免反复 IPC）：系统 + 资源库，资源库同名覆盖系统 */
let fontCache: FontItem[] | null = null
const fonts = ref<FontItem[]>(fontCache ?? [])
const loadingFonts = ref(fontCache == null)

onMounted(async () => {
  if (fontCache) return
  try {
    const list = await window.preload.font.listFonts()
    fontCache = list
    fonts.value = list
  } finally {
    loadingFonts.value = false
  }
})

const fontGroups = computed(() => {
  // 资源库字体（自定义字体）为会员功能：非会员可见但锁定选择
  const fontsLocked = !useAuthStore().features.customFonts
  const groups = [
    { label: '系统字体', items: fonts.value.filter((f) => f.source === 'system'), disabled: false },
    {
      label: fontsLocked ? '资源库字体（会员）' : '资源库字体',
      items: fonts.value.filter((f) => f.source === 'library'),
      disabled: fontsLocked
    }
  ]
  // 当前字体不在本机列表（如 AI 写入未安装字体）时兜底展示，避免下拉显示空白
  const current = props.draft.fontFamily
  if (current && !fonts.value.some((f) => f.name === current)) {
    groups.unshift({ label: '当前字体', items: [{ name: current, path: '', source: 'system' }], disabled: false })
  }
  return groups.filter((g) => g.items.length)
})
</script>
<style scoped lang="less">
.text-property-fields {
  &__title {
    margin: 8px 0;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__font-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-width: 0;
  }

  &__font-preview {
    flex: 1;
    min-width: 0;
    font-size: 13px;
  }

  &__font-name {
    flex: none;
    max-width: 140px;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
