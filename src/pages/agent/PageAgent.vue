<template>
  <page-layout :title="group?.name || '分组'">
    <div class="group-page">
      <div class="group-summary">
        <t-card title="提示词" size="small" hover-shadow class="summary-card">
          <p class="prompt-text" :title="promptPreview">{{ promptPreview }}</p>
        </t-card>
        <t-card title="启用的工具" size="small" hover-shadow class="summary-card">
          <p class="tools-text" :title="enabledToolsText">{{ enabledToolsText }}</p>
        </t-card>
      </div>

      <div class="chat-section">
        <div class="chat-section__header">
          <div>
            <div class="chat-section__title">历史对话</div>
            <div class="chat-section__desc">共 {{ chats.length }} 条对话</div>
          </div>
          <t-button theme="primary" @click="openNewGroup()">
            <template #icon>
              <add-icon />
            </template>
            新建对话
          </t-button>
        </div>

        <div v-if="chats.length > 0" class="chat-list">
          <t-card
            v-for="chat in chats"
            :key="chat.id"
            size="small"
            hover-shadow
            class="chat-card"
            @click="openGroupChat(chat)"
            :title="chat.name || '未命名对话'"
          >
            <div class="chat-card__content">
              <div class="chat-card__main">
                <div class="chat-card__message">{{ chat.form.content || '暂无首条消息' }}</div>
              </div>
            </div>
            <template #actions>
              <t-tag v-if="chat.top" theme="primary" variant="light" size="small">置顶</t-tag>
              <span>{{ chat.form.model || '未设置模型' }}</span>
            </template>
          </t-card>
        </div>
        <t-empty v-else description="暂无历史对话">
          <template #action>
            <t-button theme="primary" @click="openNewGroup()">开始新对话</t-button>
          </template>
        </t-empty>
      </div>
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import { AddIcon } from 'tdesign-icons-vue-next'
import { AiChatItem, AiAgent, buildAiAgentPrompt } from '@/entity/ai'
import { aiChatList, useAiAgentStore, useSettingAiStore } from '@/store'
import { toolMap } from '@/modules/tool'

const route = useRoute()
const router = useRouter()

const group = ref<AiAgent>()
const chats = ref<Array<AiChatItem>>([])

const promptPreview = computed(() => (group.value ? buildAiAgentPrompt(group.value) : '暂无提示词'))
const enabledToolsText = computed(
  () => group.value?.tools.map((e) => toolMap[e]?.label).join('、') || '暂无启用工具'
)

const openNewGroup = () => router.push(`/new/${group.value?.id || '0'}`)
const openGroupChat = (chat: AiChatItem) => router.push(`/chat/${group.value?.id}/${chat.id}`)

onMounted(async () => {
  group.value = useAiAgentStore().getById(route.params.id as string)
  chats.value = await aiChatList(group.value?.id as string)
  const { optionMap } = useSettingAiStore()
  chats.value = chats.value
    .map((e) => ({
      ...e,
      form: {
        ...e.form,
        model: optionMap.get(e.form.model)?.model || e.form.model
      }
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
})
</script>
<style scoped lang="less">
.group-page {
  padding: 0 24px 24px;
}

.group-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--td-comp-margin-l);
  margin-bottom: var(--td-comp-margin-xl);
}

.summary-card {
  border-radius: var(--td-radius-large);
}

.prompt-text,
.tools-text {
  display: -webkit-box;
  margin: 0;
  min-height: 44px;
  overflow: hidden;
  color: var(--td-text-color-secondary);
  font: var(--td-font-body-medium);
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.tools-text {
  line-height: 22px;
}

.chat-section {
  padding: var(--td-comp-paddingTB-l) 0;
}

.chat-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--td-comp-margin-l);
  margin-bottom: var(--td-comp-margin-l);
}

.chat-section__title {
  color: var(--td-text-color-primary);
  font: var(--td-font-title-medium);
}

.chat-section__desc {
  margin-top: var(--td-comp-margin-xxs);
  color: var(--td-text-color-placeholder);
  font: var(--td-font-body-small);
}

.chat-list {
  display: grid;
  gap: var(--td-comp-margin-s);
}

.chat-card {
  border-radius: var(--td-radius-large);
  cursor: pointer;
  &:hover {
    .chat-card__title {
      color: var(--td-brand-color);
    }
  }
}

.chat-card__content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--td-comp-margin-l);
}

.chat-card__main {
  min-width: 0;
}

.chat-card__title {
  overflow: hidden;
  color: var(--td-text-color-primary);
  font: var(--td-font-body-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.3s ease-in-out;
}

.chat-card__message {
  margin-top: var(--td-comp-margin-xs);
  overflow: hidden;
  color: var(--td-text-color-secondary);
  font: var(--td-font-body-small);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-card__meta {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--td-comp-margin-s);
  color: var(--td-text-color-placeholder);
  font: var(--td-font-body-small);
}

@media (max-width: 720px) {
  .group-page {
    padding: 0 16px 16px;
  }

  .group-summary {
    grid-template-columns: 1fr;
  }

  .chat-section__header,
  .chat-card__content {
    align-items: stretch;
    flex-direction: column;
  }

  .chat-card__meta {
    justify-content: space-between;
  }
}
</style>
