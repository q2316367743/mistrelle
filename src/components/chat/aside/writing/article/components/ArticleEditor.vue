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
        <chat-content :content="content" />
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ChatContent } from '@tdesign-vue-next/chat'

const props = defineProps<{
  content: string
  articleTitle: string
}>()

const emit = defineEmits<{
  (e: 'change', value: string): void
}>()

const mode = ref<'edit' | 'preview'>('edit')

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
