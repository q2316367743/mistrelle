<template>
  <div class="article-editor">
    <monaco-editor-view
      v-show="mode === 'edit'"
      :value="content"
      language="markdown"
      height="100%"
      :minimap="false"
      :readonly="false"
      @change="handleChange"
    />
    <div v-show="mode === 'preview'" class="article-editor__preview">
      <chat-content :content="previewContent" />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ChatContent } from '@tdesign-vue-next/chat'
import { resolveArticleMarkdown } from '@/modules/tool/components/article/imageRef'

const props = defineProps<{
  content: string
  /** 编辑 / 预览模式（由侧边栏 header 控制） */
  mode: 'edit' | 'preview'
  /** 文章 md 所在目录（用于预览时把相对路径图片解析为本地链接） */
  baseDir?: string
}>()

const emit = defineEmits<{
  (e: 'change', value: string): void
}>()

/** 预览内容：预处理相对路径图片为 file:// 链接（不改源文件） */
const previewContent = computed(() =>
  props.baseDir ? resolveArticleMarkdown(props.content, props.baseDir) : props.content
)

const handleChange = (value?: string) => {
  emit('change', value ?? '')
}
</script>
<style scoped lang="less">
.article-editor {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;

  &__preview {
    flex: 1;
    overflow: auto;
    padding: 12px;
    box-sizing: border-box;
  }
}
</style>
