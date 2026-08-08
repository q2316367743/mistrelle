<template>
  <article-aside :sandbox="sandbox" :workspace="workspace" :fullscreen="fullscreen" />
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
    /** 侧边栏全屏：转发给文章侧边栏，驱动编辑 / 预览模式 */
    fullscreen?: boolean
  }>(),
  {
    sandbox: '',
    workspace: '',
    writingScene: 'article',
    fullscreen: false
  }
)
</script>
