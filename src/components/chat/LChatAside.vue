<template>
  <div class="l-chat-aside">
    <t-select v-model="active">
      <t-option value="overview" label="概览" />
      <t-option value="workspace" label="工作空间" />
    </t-select>
    <div v-if="active === 'overview'" class="l-chat-aside__content">
      <sub-title title="任务进程" />
      <sub-title title="产物" />
      <div
        v-for="output in outputs"
        class="product-item"
        :key="output.path"
        @click="openFilePreview({fileName: output.name, fullPath: output.path})"
      >
        <file-icon />
        <span class="ellipsis w-180px">{{ output.name }}</span>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ChatMessage, type ToolCallContent } from '@/domain'
import { AiChatItem } from '@/entity'
import { FileIcon } from 'tdesign-icons-vue-next'
import { openFilePreview } from '@/components/chat/chat-assistant/modals/FilePreviewDialog'

const props = defineProps({
  messages: {
    type: Array as PropType<Array<ChatMessage>>,
    default: () => []
  },
  chat: {
    type: Object as PropType<AiChatItem>,
    required: true
  }
})

const toolCallNames = ['file_write_xlsx', 'file_write']

const outputs = computed(() => {
  const map = new Map<string, string>()
  props.messages.forEach((message) => {
    if (message.role === 'assistant') {
      message.content?.forEach((item) => {
        if (item.type !== 'toolcall' || item.status !== 'complete') return
        const tc = item as ToolCallContent
        if (!toolCallNames.includes(tc.data.toolCallName)) return
        const args = tc.data.args
        if (!args) return
        try {
          const parsed = JSON.parse(args)
          const fullPath: string = parsed.path ?? ''
          if (!fullPath) return
          if (map.has(fullPath)) return
          const fileName = window.preload.path.basename(fullPath)
          map.set(fullPath, fileName)
        } catch {
          // ignore parse errors
        }
      })
    }
  })
  return Array.from(map)
    .map(([path, name]) => ({ name, path }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const active = ref('overview')
</script>
<style scoped lang="less">
.l-chat-aside {
  height: 100%;
  padding: 8px 0 8px 8px;

  &__content {
    margin-top: 8px;
    height: calc(100vh - 104px);
    overflow: auto;
  }
  .product-item {
    padding: 4px;
    cursor: pointer;
    transition: background-color 0.3s ease-in-out;
    border-radius: var(--td-radius-medium);
    &:hover {
      background-color: var(--td-bg-color-component-hover);
    }
    span {
      margin-left: 8px;
    }
  }
}
</style>
