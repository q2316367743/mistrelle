<template>
  <div class="article-editor">
    <div class="article-editor__toolbar">
      <t-radio-group v-model="mode" size="small" theme="button" variant="default-filled">
        <t-radio-button value="edit">编辑</t-radio-button>
        <t-radio-button value="preview">预览</t-radio-button>
      </t-radio-group>
      <t-tag theme="primary" variant="light" size="small" class="article-editor__name">
        {{ articleTitle }}
      </t-tag>
    </div>
    <div class="article-editor__body">
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
  </div>
</template>
<script lang="ts" setup>
import { ChatContent } from '@tdesign-vue-next/chat'
import { resolveArticleMarkdown } from '@/modules/tool/components/article/imageRef'

const props = defineProps<{
  content: string
  articleTitle: string
  /** 文章 md 所在目录（用于预览时把相对路径图片解析为本地链接） */
  baseDir?: string
}>()

const emit = defineEmits<{
  (e: 'change', value: string): void
}>()

const mode = ref<'edit' | 'preview'>('edit')

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
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    border-bottom: 1px solid var(--td-border-level-1-color);
  }

  &__name {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__body {
    flex: 1;
    min-height: 0;
  }

  &__preview {
    height: 100%;
    overflow: auto;
    padding: 12px;
    box-sizing: border-box;
  }
}
</style>
