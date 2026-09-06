<template>
  <div ref="bodyRef" class="html-design-preview">
    <div v-if="!doc" class="html-design-preview__empty">{{ emptyText }}</div>
    <div
      v-else
      class="html-design-preview__stage"
      :style="{ width: `${doc.width * scale}px`, height: `${doc.height * scale}px` }"
    >
      <iframe
        ref="frameRef"
        class="html-design-preview__frame"
        sandbox="allow-same-origin"
        title="HTML 设计稿预览"
        :style="{
          width: `${doc.width}px`,
          height: `${doc.height}px`,
          transform: `scale(${scale})`
        }"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import {
  prepareDesignHtmlDocument,
  type HtmlDesignDoc
} from '@/windows/main/modules/designHtml'

const props = withDefaults(
  defineProps<{
    /** 当前设计稿（null 显示占位）；doc 变更即重建预览文档 */
    doc?: HtmlDesignDoc | null
  }>(),
  {
    doc: null
  }
)

const emptyText = '请先让 AI 创建 HTML 设计稿'
const bodyRef = ref<HTMLElement>()
const frameRef = ref<HTMLIFrameElement>()
/** 预览缩放：contain 适配容器，上限 1x 防止放大模糊 */
const scale = ref(1)

/** 按容器与设计稿逻辑尺寸重算 contain 缩放（留 12px 内边距） */
const updateScale = () => {
  const doc = props.doc
  const body = bodyRef.value
  if (!doc || !body) return
  const s = Math.min((body.clientWidth - 12) / doc.width, (body.clientHeight - 12) / doc.height)
  scale.value = Math.max(0.05, Math.min(1, s))
}

/** 将设计稿装配（图片 dataURL 化 + 基础画布样式）后写入预览 iframe */
const renderDoc = async (doc: HtmlDesignDoc) => {
  const frame = frameRef.value
  if (!frame) return
  const html = await prepareDesignHtmlDocument(doc)
  const docEl = frame.contentDocument
  if (!docEl) return
  docEl.open()
  docEl.write(html)
  docEl.close()
}

// doc 变更 → 重建预览；flush: post 保证 v-else 分支的 iframe 已挂载后再写入文档
watch(
  () => props.doc,
  async (doc) => {
    updateScale()
    if (doc) await renderDoc(doc)
  },
  { flush: 'post' }
)

// 容器尺寸变化时重算 contain 缩放（侧边栏拖宽 / 全屏切换）
const { width: bodyWidth, height: bodyHeight } = useElementSize(bodyRef)
watch([bodyWidth, bodyHeight], () => updateScale())
</script>
<style scoped lang="less">
.html-design-preview {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  &__empty {
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__stage {
    position: relative;
    overflow: hidden;
    border-radius: var(--td-radius-medium);
    box-shadow: var(--td-shadow-1);
  }

  &__frame {
    display: block;
    border: 0;
    background: var(--td-bg-color-page);
    transform-origin: top left;
  }
}
</style>
