<template>
  <div class="m-chat-user">
    <!-- 用户消息内联展示：文本为文字，skill/file 为不同色与图标的标签，整行内联 -->
    <div class="r-chat-list__user-content">
      <template v-for="(item, index) in message.content" :key="item.id || index">
        <span v-if="item.type === 'text'" class="r-chat-list__text">{{ item.data }}</span>
        <t-tag
          v-else-if="item.type === 'skill'"
          theme="primary"
          variant="light"
          :title="item.data.path"
          size="small"
          class="r-chat-list__inline-tag mr-4px"
        >
          <template #icon><CodeIcon /></template>
          {{ item.data.name }}
        </t-tag>
        <t-tag
          v-else-if="item.type === 'tool'"
          theme="warning"
          variant="light"
          :title="item.data.label"
          size="small"
          class="r-chat-list__inline-tag mr-4px"
        >
          <template #icon><ToolsIcon /></template>
          {{ item.data.label }}
        </t-tag>
        <template v-else-if="item.type === 'attachment'">
          <t-tag
            v-for="(file, fi) in item.data"
            :key="file.url || fi"
            theme="success"
            variant="light"
            :title="file.url"
            class="r-chat-list__inline-tag"
          >
            <template #icon><FileIcon /></template>
            @{{ file.name }}
          </t-tag>
        </template>
        <t-tag
          v-else-if="item.type === 'canvas'"
          theme="default"
          variant="light"
          :title="`画布 canvas-${item.data.version} 节点 ${item.data.nodeId}`"
          size="small"
          class="r-chat-list__inline-tag mr-4px"
        >
          <template #icon><LayersIcon /></template>
          画布(canvas-{{ item.data.version }})节点({{ item.data.label || item.data.nodeId }})
        </t-tag>
      </template>
    </div>
    <div class="footer">
      <RChatActionbar
        :content="getUserText(message)"
        role="user"
        @delete="$emit('delete', message.id)"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { UserMessage } from '@/domain'
import { ChatMessage } from '@tdesign-vue-next/chat'
import { CodeIcon, FileIcon, LayersIcon, ToolsIcon } from 'tdesign-icons-vue-next'

defineProps({
  message: {
    type: Object as PropType<UserMessage>,
    required: true
  }
})
defineEmits(['delete'])

const getUserText = (message: UserMessage) => {
  return message.content.find((item) => item.type === 'text')?.data ?? ''
}
</script>
<style scoped lang="less">
.m-chat-user {
  width: fit-content;
  margin-left: auto;
  // 用户消息内容：文本与标签像一段文字内联排列，自然换行
  .r-chat-list__user-content {
    padding: 8px;
    border: 1px solid var(--td-border-level-1-color);
    border-radius: var(--td-radius-large);
    overflow-wrap: break-word;
    display: block;
    line-height: 22px;

    .r-chat-list__text {
      white-space: pre-wrap;
      overflow-wrap: break-word;
    }
  }
  .footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }
}
</style>
