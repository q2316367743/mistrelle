<template>
  <div class="prop-field">
    <div class="prop-field__label">
      {{ prop.label }}
      <t-tooltip v-if="prop.hint" :content="prop.hint">
        <HelpCircleIcon class="prop-field__hint" />
      </t-tooltip>
    </div>

    <t-color-picker
      v-if="prop.type === 'color'"
      :value="value || prop.fallback"
      format="HEX"
      :color-modes="['monochrome']"
      :enable-alpha="false"
      :input-props="{ clearable: true }"
      @change="(v: string) => emit('update', v)"
    />

    <t-input-number
      v-else-if="prop.type === 'length' || prop.type === 'number'"
      :value="toNumber"
      :min="prop.min"
      :max="prop.max"
      :step="prop.type === 'number' ? 0.1 : 1"
      :decimal-places="prop.type === 'number' ? 2 : 0"
      theme="normal"
      align="left"
      :suffix="prop.type === 'length' ? prop.unit ?? 'px' : ''"
      @change="(v: unknown) => emit('update', toStoreValue(v))"
    />

    <t-select
      v-else-if="prop.type === 'enum'"
      :value="value || prop.fallback"
      :options="prop.options"
      @change="(v) => emit('update', String(v))"
    />

    <t-select
      v-else-if="prop.type === 'font'"
      :value="value"
      :options="fontOptions"
      :loading="fontLoading"
      clearable
      filterable
      placeholder="留空继承默认"
      @change="(v) => emit('update', v == null ? '' : String(v))"
    >
      <template #optionContent="{ option }">
        <span :style="{ fontFamily: `'${String(option.value)}'` }">{{ option.label }}</span>
      </template>
    </t-select>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, onMounted } from 'vue'
import { HelpCircleIcon } from 'tdesign-icons-vue-next'
import type { CardStyleProp } from '@/global/card-style-props'

/**
 * 注册表驱动的单属性编辑控件：按 prop.type 渲染对应 tdesign 控件，
 * 值统一以字符串承载（存储形状），数值类控件在边界处互转。
 */
const props = defineProps<{ prop: CardStyleProp; value: string }>()
const emit = defineEmits<{ update: [value: string] }>()

/** 数值类：从存储字符串解析数字（非法回落 min 或 0） */
const toNumber = computed(() => {
  const n = Number.parseFloat(props.value)
  if (!Number.isNaN(n)) return n
  return props.prop.min ?? 0
})

/** 控件数值 → 存储字符串（length 带 px，number 保留两位内小数） */
const toStoreValue = (v: unknown): string => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v))
  if (Number.isNaN(n)) return props.prop.fallback
  if (props.prop.type === 'length') return `${Math.round(n)}${props.prop.unit ?? 'px'}`
  return String(Math.round(n * 100) / 100)
}

// ------------------------- 真实字体下拉（本机字体，带预览） -------------------------
const fontLoading = ref(false)
const fontOptions = ref<Array<{ label: string; value: string }>>([])

onMounted(async () => {
  if (props.prop.type !== 'font' || fontOptions.value.length > 0) return
  fontLoading.value = true
  try {
    const fonts = await window.preload.font.listFonts()
    fontOptions.value = fonts.map((f) => ({ label: f.name, value: f.name }))
  } finally {
    fontLoading.value = false
  }
})
</script>

<style scoped lang="less">
.prop-field {
  &__label {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  &__hint {
    cursor: help;
    color: var(--td-text-color-placeholder);

    &:hover {
      color: var(--td-text-color-secondary);
    }
  }

  :deep(.t-color-picker__selector) {
    width: 100%;
  }
}
</style>
