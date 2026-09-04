<template>
  <article-aside
    v-if="writingScene === 'article'"
    :sandbox="sandbox"
    :workspace="workspace"
    :fullscreen="fullscreen"
  />
  <novel-aside
    v-else
    :sandbox="sandbox"
    :workspace="workspace"
    :fullscreen="fullscreen"
  />
</template>
<script lang="ts" setup>
import type { WritingScene } from '@/windows/main/modules/chat'
import ArticleAside from './article/ArticleAside.vue'
import NovelAside from './novelShort/NovelAside.vue'

withDefaults(
  defineProps<{
    sandbox?: string
    workspace?: string
    /** 写作子场景：article（文章创作）/ novelShort（短篇小说） */
    writingScene?: WritingScene
    /** 侧边栏全屏：转发给场景侧边栏，驱动编辑 / 预览模式与布局切换 */
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
