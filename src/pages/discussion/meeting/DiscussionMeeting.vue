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
        <div class="discussion-brief__info">
          <div class="discussion-brief__label">预设流程 · 固定角色 · 回合制</div>
          <div class="discussion-brief__desc">
            {{ discussion.description || '输入议题后，角色会按配置的顺序输出观点。' }}
          </div>
        </div>
        <div class="discussion-brief__aside">
          <div class="discussion-brief__roles">
            <t-tag v-for="role in orderedRoles" :key="role.id" variant="light-outline">
              {{ role.name || '未命名角色' }}
            </t-tag>
          </div>
          <t-button
            theme="default"
            variant="text"
            shape="square"
            title="讨论设置"
            @click="openSettings"
          >
            <template #icon><setting-icon /></template>
          </t-button>
        </div>
      </section>

      <!-- 第一步：尚未开始，仅展示引子输入框 -->
      <div v-if="!started" class="discussion-hero">
        <discussion-composer
          v-model="input"
          :can-start="canStart"
          @start="handleStart"
          @advanced="openSettings"
        />
      </div>

      <!-- 第二/三步：讨论进行中，消息流 + 轮后控制 + 补充输入 -->
      <template v-else>
        <discussion-message-list
          ref="messageListRef"
          :messages="record?.messages || []"
          :roles="discussion.roles"
          :summary-role="record?.config.summaryRole"
          @delete="handleDeleteMessage"
        />

        <footer class="discussion-footer">
          <discussion-round-controls
            v-if="!running"
            :round="record?.currentRound || 0"
            @next="handleNextRound"
            @supplement="focusSupplement"
            @settings="openSettings"
          />
          <div class="discussion-sender">
            <t-textarea
              ref="supplementRef"
              v-model="input"
              :disabled="running"
              :autosize="{ minRows: 2, maxRows: 5 }"
              placeholder="补充信息或新的视角，提交后会推进下一轮。"
            />
            <div class="discussion-sender__bar">
              <div class="discussion-sender__hint">当前第 {{ record?.currentRound || 0 }} 轮</div>
              <div class="discussion-sender__actions">
                <t-button v-if="running" theme="warning" variant="outline" @click="handleStop">
                  <template #icon><stop-icon /></template>
                  停止
                </t-button>
                <t-button
                  variant="outline"
                  :disabled="running || !record?.config.summaryRole"
                  @click="handleSummarize"
                >
                  总结
                </t-button>
                <t-button
                  theme="primary"
                  :disabled="running || !input.trim()"
                  @click="handleSupplement"
                >
                  <template #icon><send-icon /></template>
                  发送
                </t-button>
              </div>
            </div>
          </div>
        </footer>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { SendIcon, SettingIcon, StopIcon } from 'tdesign-icons-vue-next'
import DiscussionMessageList from './components/DiscussionMessageList.vue'
import DiscussionSessionList from './components/DiscussionSessionList.vue'
import DiscussionComposer from './components/DiscussionComposer.vue'
import DiscussionRoundControls from './components/DiscussionRoundControls.vue'
import { useDiscussionPage } from './useDiscussionPage'

const {
  discussion,
  records,
  record,
  input,
  loading,
  messageListRef,
  running,
  started,
  canStart,
  orderedRoles,
  handleStart,
  handleNextRound,
  handleSupplement,
  handleSummarize,
  handleStop,
  openSettings,
  handleNewSession,
  handleSelectSession,
  handleDeleteMessage
} = useDiscussionPage()

const supplementRef = ref()
const focusSupplement = () => supplementRef.value?.focus?.()
</script>

<style scoped lang="less">
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

.discussion-brief {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--td-comp-margin-m);
  margin: var(--td-comp-margin-m) var(--td-comp-margin-l) 0;
  padding: var(--td-comp-paddingTB-m) var(--td-comp-paddingLR-l);
  border: 1px solid var(--fluent-card-border);
  border-radius: var(--fluent-radius-card);
  background: var(--fluent-card-bg);
  box-shadow: var(--fluent-card-shadow);
}

.discussion-brief__info {
  min-width: 0;
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

.discussion-brief__aside {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
}

.discussion-brief__roles {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--td-comp-margin-s);
}

.discussion-hero {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: var(--td-comp-paddingTB-l) var(--td-comp-paddingLR-xl);
  overflow: auto;
}

.discussion-footer {
  display: flex;
  flex-direction: column;
  gap: var(--td-comp-margin-s);
  margin: 0 var(--td-comp-margin-l) var(--td-comp-margin-m);
}

.discussion-sender {
  padding: var(--td-comp-paddingTB-m) var(--td-comp-paddingLR-l);
  border: 1px solid var(--fluent-card-border);
  border-radius: var(--fluent-radius-card);
  background: var(--fluent-card-bg);
  box-shadow: var(--fluent-card-shadow);
}

.discussion-sender__bar,
.discussion-sender__actions {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
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
  .discussion-footer {
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
