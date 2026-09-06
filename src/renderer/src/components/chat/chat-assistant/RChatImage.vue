<template>
  <t-image-viewer v-if="src" :images="[src]" :title="content.data.name ?? '生成图片'" close-on-overlay>
    <template #trigger="{ open }">
      <t-image
        :src="src"
        :alt="content.data.name ?? '生成图片'"
        :style="boxStyle"
        fit="cover"
        shape="round"
        class="r-chat-image"
        @click="open()"
      />
    </template>
  </t-image-viewer>
</template>
<script lang="ts" setup>
import { computed } from 'vue'
import type { PropType } from 'vue'
import type { ImageContent } from '@/domain'

/**
 * AI 消息内的图片内容块（type: 'image'）：气泡内小图展示本地生成图片，
 * 点击经 t-image-viewer 浮层放大预览。数据由执行器按工具返回的 chatImages 标记回填
 * （url 为本地绝对路径）。
 */
const props = defineProps({
  content: {
    type: Object as PropType<ImageContent>,
    required: true
  }
})

const src = computed(() =>
  props.content.data.url ? window.preload.net.pathToHref(props.content.data.url) : ''
)

/** 已知真实尺寸时按原图比例占位，未知时用固定高度兜底 */
const boxStyle = computed(() => {
  const { width, height } = props.content.data
  if (width != null && height != null && width > 0 && height > 0) {
    return { aspectRatio: `${width} / ${height}` }
  }
  return { height: '180px' }
})
</script>
<style scoped lang="less">
.r-chat-image {
  width: 240px;
  max-width: 100%;
  cursor: zoom-in;
  background: var(--td-bg-color-secondarycontainer);
}
</style>
