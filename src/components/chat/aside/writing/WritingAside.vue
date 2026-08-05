<template>
  <article-aside :sandbox="sandbox" :workspace="workspace" />
</template>
<script lang="ts" setup>
import type { WritingScene } from '@/modules/chat'
import ArticleAside from './article/ArticleAside.vue'

withDefaults(
  defineProps<{
    sandbox?: string
    workspace?: string
    /** 写作子场景（仅 article；保留 prop 供未来 novel 等场景扩展） */
    writingScene?: WritingScene
  }>(),
  {
    sandbox: '',
    workspace: '',
    writingScene: 'article'
  }
)
</script>
