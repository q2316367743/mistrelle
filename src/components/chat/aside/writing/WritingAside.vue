<template>
  <free-writing-aside
    v-if="writingScene === 'free'"
    :sandbox="sandbox"
    :workspace="workspace"
  />
  <article-aside v-else :sandbox="sandbox" :workspace="workspace" />
</template>
<script lang="ts" setup>
import type { WritingScene } from '@/modules/chat'
import FreeWritingAside from './free/FreeWritingAside.vue'
import ArticleAside from './article/ArticleAside.vue'

withDefaults(
  defineProps<{
    sandbox?: string
    workspace?: string
    writingScene?: WritingScene
  }>(),
  {
    sandbox: '',
    workspace: '',
    writingScene: 'free'
  }
)
</script>
