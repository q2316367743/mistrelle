<template>
  <ChatMessage variant="outline" placement="right" :role="message.role">
    <template #content>
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
        </template>
      </div>
    </template>
    <template #actionbar>
      <RChatActionbar
        :content="getUserText(message)"
        role="user"
        @delete="$emit('delete', message.id)"
      />
    </template>
  </ChatMessage>
</template>
<script lang="ts" setup>
import { UserMessage } from '@/domain'
import { ChatMessage } from '@tdesign-vue-next/chat'

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
<style scoped lang="less"></style>
