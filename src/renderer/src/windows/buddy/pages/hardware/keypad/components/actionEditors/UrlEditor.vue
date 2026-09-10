<template>
  <t-input
    :value="model?.url ?? ''"
    placeholder="https://example.com"
    clearable
    :status="urlInvalid ? 'error' : undefined"
    :tips="urlInvalid ? '网址需以 http:// 或 https:// 开头' : undefined"
    @change="onUrlChange"
  />
</template>

<script lang="ts" setup>
import type { KeypadAction, KeypadUrlAction } from '@common/types/keypad'
import { isValidKeypadUrl } from '@common/keypad/actions'

defineOptions({ name: 'KeypadUrlEditor' })

const props = defineProps<{ action: KeypadAction }>()
const emit = defineEmits<{ change: [action: KeypadAction] }>()

/** 本编辑器只服务 url 动作（父级按注册表分发，运行时恒为 url） */
const model = computed(
  (): KeypadUrlAction | null => (props.action.type === 'url' ? props.action : null)
)

/** 已填但不合法（非 http/https 协议）时标红提示；空串仅由保存预校验拦截 */
const urlInvalid = computed(() => {
  const url = model.value?.url.trim() ?? ''
  return url !== '' && !isValidKeypadUrl(url)
})

function onUrlChange(value: unknown): void {
  const url = typeof value === 'string' ? value : ''
  if (model.value) emit('change', { ...model.value, url })
}
</script>
