<template>
  <span
    class="font-preview-text"
    :style="{ fontFamily, opacity: ready ? 1 : 0.4 }"
    :title="font.name"
  >
    字体预览 Preview 123
  </span>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { ensureFontPreview } from '@/utils/fontPreview'

const props = defineProps<{
  font: Pick<FontItem, 'name' | 'path' | 'source'>
}>()

const ready = ref(props.font.source === 'system')
const fontFamily = computed(() => `"${props.font.name}", sans-serif`)

onMounted(() => {
  if (props.font.source === 'system') return
  ensureFontPreview(props.font).then(() => {
    ready.value = true
  })
})
</script>

<style scoped lang="less">
.font-preview-text {
  font-size: 16px;
  color: var(--td-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: opacity 0.2s ease;
}
</style>
