<template>
  <div class="preview-scaler flex flex-col items-center gap-8">
    <div v-for="(html, i) in cardsHtml" :key="i" class="relative">
      <div v-html="html"></div>
      <span v-if="pages.length > 1" class="absolute -bottom-6 right-1 text-xs text-[#AAA]">
        {{ i + 1 }} / {{ pages.length }}
      </span>
    </div>

    <!-- 隐藏量测容器：块真实高度喂给分页器，预览与导出共用同一分页结果 -->
    <div
      ref="measureRef"
      aria-hidden="true"
      :style="{
        position: 'absolute',
        left: -99999,
        top: 0,
        visibility: 'hidden',
        pointerEvents: 'none',
        width: `${rt.contentWidth}px`,
        fontFamily: rt.fontFamily,
        fontSize: `${rt.fontSize}px`,
        lineHeight: rt.lineHeight
      }"
      v-html="measurerHtml"
    ></div>
    <span class="hidden">{{ fontTick }}</span>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watchPostEffect } from 'vue'
import {
  imageBlockHeight,
  paginateXhs,
  parseSegments,
  type XhsImage,
  type XhsPage,
  type XhsRuntime
} from './protocol'
import { buildCardHtml, buildMeasurerInnerHtml, type CardMeta } from './card-html'

/**
 * 参考站 PreviewCard 的移植：DOM 实时预览与 snapdom 导出共用 card-html 单一事实源，
 * 隐藏容器量取每个块的真实渲染高度后切页，保证所见即所得。
 */
const props = defineProps<{
  content: string
  nickname: string
  dateStr: string
  avatar?: string | null
  images: Array<XhsImage>
  watermark: string
  runtime: XhsRuntime
}>()

const emit = defineEmits<{ pagesChange: [count: number] }>()

const rt = computed(() => props.runtime)
const meta = computed<CardMeta>(() => ({
  nickname: props.nickname,
  dateStr: props.dateStr,
  avatar: props.avatar,
  watermark: props.watermark
}))
const segments = computed(() => parseSegments(props.content, props.images.length))
const pages = ref<Array<XhsPage>>([{ items: [], fullBleed: false }])
const measureRef = ref<HTMLElement | null>(null)
const fontTick = ref(0)

const measurerHtml = computed(() => buildMeasurerInnerHtml(segments.value, props.images, rt.value))
const cardsHtml = computed(() =>
  pages.value.map((page, i) => buildCardHtml(page, segments.value, props.images, rt.value, meta.value, i))
)

let fontHooked = false
onMounted(() => {
  if (fontHooked) return
  fontHooked = true
  document.fonts?.ready.then(() => {
    fontTick.value++
  })
})

watchPostEffect(() => {
  // 依赖收集：内容 / 配图 / 水印 / 风格 / 字体就绪 tick 任一变化后重测
  void segments.value
  void props.images
  void props.watermark
  void rt.value
  void fontTick.value
  measure()
})

const measure = () => {
  const container = measureRef.value
  if (!container) return
  const heights = Array.from(container.children).map((el) => (el as HTMLElement).offsetHeight)
  const items = segments.value.map((seg, i) =>
    seg.type === 'text'
      ? { kind: 'text' as const, h: heights[i] || 27 }
      : {
          kind: 'image' as const,
          h: imageBlockHeight(props.images[seg.index ?? 0], rt.value.contentWidth),
          im: props.images[seg.index ?? 0]
        }
  )
  const next = paginateXhs(items, !!props.watermark, rt.value)
  if (JSON.stringify(next) !== JSON.stringify(pages.value)) pages.value = next
  emit('pagesChange', next.length)
}
</script>
