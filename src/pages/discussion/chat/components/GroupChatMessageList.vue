<template>
  <div ref="containerRef" class="group-msg-list">
    <div v-if="messages.length === 0" class="group-msg-list__empty">
      <t-empty description="还没有消息，输入 @ 选择成员开始群聊" />
    </div>
    <div v-else class="group-msg-list__messages">
      <ChatMessage
        v-for="message in messages"
        :key="message.id"
        class="group-msg-list__item"
        :placement="message.type === 'user' ? 'right' : 'left'"
        :variant="message.type === 'user' ? 'outline' : 'text'"
        :role="message.type === 'user' ? 'user' : 'assistant'"
        :name="message.type === 'user' ? undefined : getSpeaker(message)"
        :avatar="message.type === 'user' ? userProfile.avatar : undefined"
      >
        <template v-if="message.type !== 'user'" #avatar>
          <t-avatar size="32px" shape="circle">{{ getSpeaker(message).slice(0, 1) }}</t-avatar>
        </template>
        <template #content>
          <!-- 用户消息：按 segments 顺序渲染，保留原始输入 -->
          <div v-if="message.type === 'user'" class="group-msg-list__user-content">
            <template v-if="message.segments">
              <template v-for="(seg, idx) in message.segments" :key="idx">
                <t-tag
                  v-if="seg.type === 'at'"
                  size="small"
                  theme="warning"
                  variant="light"
                >
                  @{{ seg.content }}
                </t-tag>
                <span v-else class="group-msg-list__text">{{ seg.content }}</span>
              </template>
            </template>
            <span v-else class="group-msg-list__text">{{ message.content }}</span>
          </div>

          <!-- AI / 摘要消息 -->
          <template v-else>
            <ChatContent v-if="message.content" :content="message.content" />
            <ChatLoading
              v-else-if="message.status === 'pending' || message.status === 'streaming'"
              animation="moving"
              :text="message.status === 'pending' ? '正在思考…' : '正在输出…'"
            />
            <div v-else-if="message.status === 'error'" class="group-msg-list__error">
              生成失败：{{ message.content || '未知错误' }}
            </div>
            <div v-else-if="message.status === 'stop'" class="group-msg-list__stopped">已停止</div>
          </template>
        </template>
      </ChatMessage>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue'
import { ChatContent, ChatLoading, ChatMessage } from '@tdesign-vue-next/chat'
import type { AiDiscussion, AiGroupChat, AiGroupChatMessage } from '@/entity/ai'
import { useAiAgentStore } from '@/store'
import { getUserProfile } from '@/utils/native/NativeUtil'

const userProfile = getUserProfile()

const props = defineProps<{
  chat?: AiGroupChat
  discussion: AiDiscussion
}>()

const containerRef = ref<HTMLElement>()

const messages = computed(() => props.chat?.messages ?? [])

const aiAgentStore = useAiAgentStore()
const roleNameMap = computed(() => {
  const map = new Map<string, string>()
  const agents = aiAgentStore.state
  props.discussion.roles.forEach((id) => {
    const agent = agents.find((a) => a.id === id)
    if (agent) map.set(agent.id, agent.name)
  })
  return map
})

const roleName = (id?: string): string => {
  if (!id) return '未知成员'
  return roleNameMap.value.get(id) || '未知成员'
}

const getSpeaker = (message: AiGroupChatMessage): string => {
  if (message.type === 'summary') return '摘要'
  return roleName(message.roleId)
}

const scrollToBottom = () => {
  nextTick(() => {
    const el = containerRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

defineExpose({ scrollToBottom })
</script>

<style scoped lang="less">
.group-msg-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--td-comp-paddingTB-l) var(--td-comp-paddingLR-l);
}

.group-msg-list__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.group-msg-list__messages {
  display: flex;
  flex-direction: column;
  gap: var(--td-comp-margin-l);
}

.group-msg-list__item {
  scroll-margin-top: var(--td-comp-margin-xxl);

  :deep(.t-chat__item__inner) {
    align-items: flex-start;
  }
}

.group-msg-list__user-content {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px;
  line-height: 1.6;
  border: 1px solid var(--td-border-level-1-color);
  padding: 8px;
  border-radius: var(--td-radius-large);
}

.group-msg-list__text {
  white-space: pre-wrap;
  word-break: break-word;
}

.group-msg-list__error {
  color: var(--td-error-color);
  font: var(--td-font-body-small);
}

.group-msg-list__stopped {
  color: var(--td-text-color-placeholder);
  font: var(--td-font-body-small);
}
</style>
