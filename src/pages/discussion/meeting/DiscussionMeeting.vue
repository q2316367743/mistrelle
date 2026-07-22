<template>
    <div v-if="loading" class="discussion-loading">
      <t-loading size="large" text="正在加载讨论组" />
    </div>
    <div v-else-if="!discussion" class="discussion-loading">
      <t-empty type="fail" title="讨论组不存在" description="请从左侧重新选择讨论组" />
    </div>
    <div v-else class="discussion-page">
      <discussion-session-list
        :records="records"
        :active-id="record?.id"
        @new="handleNewSession"
        @select="handleSelectSession"
      />

      <main class="discussion-main">
        <section class="discussion-brief">
          <div>
            <div class="discussion-brief__label">预设流程 · 固定角色 · 回合制</div>
            <div class="discussion-brief__desc">
              {{ discussion.description || '输入议题后，角色会按配置顺序输出观点。' }}
            </div>
          </div>
          <div class="discussion-brief__roles">
            <t-tag v-for="role in orderedRoles" :key="role.id" variant="light-outline">
              {{ role.name || '未命名角色' }}
            </t-tag>
          </div>
        </section>

        <discussion-message-list
          ref="messageListRef"
          :messages="record?.messages || []"
          :roles="discussion.roles"
          :summary-role="discussion.summaryRole"
          @delete="handleDeleteMessage"
        />

        <footer class="discussion-sender">
          <t-textarea
            v-model="input"
            :disabled="running"
            :autosize="{ minRows: 2, maxRows: 5 }"
            placeholder="输入议题或补充信息。每次提交会开启一个独立回合。"
          />
          <div class="discussion-sender__bar">
            <div class="discussion-sender__hint">
              当前第 {{ record?.currentRound || 0 }} 轮 · {{ summaryText }}
            </div>
            <div class="discussion-sender__actions">
              <t-button v-if="running" theme="warning" variant="outline" @click="handleStop">
                <template #icon><stop-icon /></template>
                停止
              </t-button>
              <t-button
                variant="outline"
                :disabled="running || !record || !discussion.summaryRole"
                @click="handleSummarize"
              >
                总结
              </t-button>
              <t-button theme="primary" :loading="running" :disabled="!canRun" @click="handleRun">
                <template #icon><play-icon /></template>
                {{ record ? '下一轮' : '开始讨论' }}
              </t-button>
            </div>
          </div>
        </footer>
      </main>
    </div>
</template>

<script setup lang="ts">
import { PlayIcon, StopIcon } from 'tdesign-icons-vue-next'
import DiscussionMessageList from './components/DiscussionMessageList.vue'
import DiscussionSessionList from './components/DiscussionSessionList.vue'
import { useDiscussionPage } from './useDiscussionPage'

const {
  discussion,
  records,
  record,
  input,
  loading,
  messageListRef,
  running,
  orderedRoles,
  canRun,
  summaryText,
  handleRun,
  handleSummarize,
  handleStop,
  handleNewSession,
  handleSelectSession,
  handleDeleteMessage
} = useDiscussionPage()
</script>

<style scoped lang="less">
.page-actions {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
}

.discussion-loading,
.discussion-page {
  height: 100%;
}

.discussion-loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.discussion-page {
  display: flex;
  min-height: 0;
  background: var(--td-bg-color-page);
}

.discussion-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.discussion-brief,
.discussion-sender {
  margin: var(--td-comp-margin-m) var(--td-comp-margin-l) 0;
  padding: var(--td-comp-paddingTB-m) var(--td-comp-paddingLR-l);
  border: 1px solid var(--fluent-card-border);
  border-radius: var(--fluent-radius-card);
  background: var(--fluent-card-bg);
  box-shadow: var(--fluent-card-shadow);
}

.discussion-brief {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--td-comp-margin-m);
}

.discussion-brief__label {
  color: var(--td-brand-color);
  font: var(--td-font-title-small);
}

.discussion-brief__desc,
.discussion-sender__hint {
  color: var(--td-text-color-secondary);
  font: var(--td-font-body-small);
}

.discussion-brief__roles,
.discussion-sender__bar,
.discussion-sender__actions {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
}

.discussion-brief__roles {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.discussion-sender {
  margin-top: 0;
  margin-bottom: var(--td-comp-margin-m);
}

.discussion-sender__bar {
  justify-content: space-between;
  margin-top: var(--td-comp-margin-s);
}

@media (max-width: 820px) {
  .discussion-page,
  .discussion-brief,
  .discussion-sender__bar {
    flex-direction: column;
  }

  .discussion-brief,
  .discussion-sender {
    margin-right: var(--td-comp-margin-m);
    margin-left: var(--td-comp-margin-m);
  }

  .discussion-brief,
  .discussion-sender__bar,
  .discussion-sender__actions {
    align-items: stretch;
  }
}
</style>
