<template>
  <article-editor :content="content" :editable="mode === 'edit'" @change="$emit('change', $event)" />
</template>
<script lang="ts" setup>
/**
 * 短篇小说 markdown 编辑器：复用文章场景的 tiptap markdown 编辑器能力，
 * 不启用图片（baseDir / assetsDir 留空，图片命令与粘贴/拖入自动失效）。
 * 非全屏预览（mode=preview）/ 全屏编辑（mode=edit）由父级传入，映射为 editable。
 */
import ArticleEditor from '../../article/components/ArticleEditor.vue'

defineProps<{
  content: string
  mode: 'edit' | 'preview'
}>()

defineEmits<{
  (e: 'change', value: string): void
}>()
</script>
