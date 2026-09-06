<template>
  <div class="md-preview">
    <note-card-renderer
      ref="rendererRef"
      :style-props="styleProps"
      :template="template"
      :extra-css="css"
      :blocks="blocks"
      :author="author"
      :date="date"
      :avatar-url="avatar || undefined"
      :watermark="watermark"
      @change="emitChange"
    />
    <span v-if="pageCount > 1" class="md-preview__pages">{{ pageCount }} 页</span>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import NoteCardRenderer from '@/components/card/NoteCardRenderer.vue'
import { normalizeCardStyleProps } from '@/global/card-style-props'
import { blobToDataUrl, markdownToCardBlocks } from '../markdown-utils'

/**
 * Markdown 卡片主页面 - 实时预览：把 Markdown 源码渲染成卡片（NoteCardRenderer 富渲染实测分页）。
 * 外链图 debounce 后统一转 dataURL 再渲染，本地 dataURL 图已内嵌无额外下载。
 */
const props = defineProps<{
  content: string
  /** 未归一化的风格键值对（可缺键）；渲染前经 normalizeCardStyleProps 补齐 */
  rawStyleProps: Record<string, string>
  /** 风格 HTML 模板与自定义 CSS（渲染器内部归一兜底） */
  template?: string
  css?: string
  author: string
  date: string
  avatar?: string | null
  watermark: string
}>()

const emit = defineEmits<{ pagesChange: [count: number] }>()

const rendererRef = ref<InstanceType<typeof NoteCardRenderer> | null>(null)
const blocks = ref<Array<string>>([])
const pageCount = ref(1)

/** 归一化兜底：旧数据缺键时按注册表 fallback 补齐再渲染 */
const styleProps = computed(() => normalizeCardStyleProps(props.rawStyleProps))

const emitChange = (count: number) => {
  pageCount.value = count
  emit('pagesChange', count)
}

const convert = async () => {
  const next = await markdownToCardBlocks(props.content)
  blocks.value = next
}

let timer: ReturnType<typeof setTimeout> | null = null
watch(
  () => props.content,
  () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(convert, 350)
  },
  { immediate: true }
)

/** 供父级导出：代理 NoteCardRenderer.exportBlobs（返回 PNG dataURL 列表） */
const exportPngs = async (scale = 3): Promise<Array<string>> => {
  const renderer = rendererRef.value
  if (!renderer) return []
  const blobs = await renderer.exportBlobs(scale)
  const urls: Array<string> = []
  for (const blob of blobs) urls.push(await blobToDataUrl(blob))
  return urls
}

defineExpose({ exportPngs })
</script>

<style scoped lang="less">
.md-preview {
  position: relative;

  &__pages {
    position: absolute;
    right: 0;
    bottom: -20px;
    font-size: 12px;
    color: var(--td-text-color-placeholder);
  }
}
</style>
