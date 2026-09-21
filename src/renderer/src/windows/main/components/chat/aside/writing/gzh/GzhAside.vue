<template>
  <div class="gzh-aside" :class="{ fullscreen: fullscreen }">
    <template v-if="activeArticle">
      <article-doc-header
        :article="activeArticle"
        :articles="articles"
        :active-type="activeType"
        :entry="activeEntry"
        :assets-dir="assetsDir"
        :locked="humanizing"
        @patch-type="patchType"
        @patch-article="patchArticle"
        @switch-article="(id: string) => guardAction(() => void selectArticle(id))"
        @switch-type="(t: string) => guardAction(() => void selectType(t))"
        @refresh="handleRefresh"
      />
      <article-toolbar
        v-if="activeEntry"
        :versions="versions"
        :active-version-id="activeVersionId"
        :humanizing="humanizing"
        :streaming-version-id="streamingVersionId"
        :assets-dir="assetsDir"
        :base-dir="activeMdDir"
        :has-selection="!!selection"
        :state="editorState"
        @command="handleCommand"
        @block-type="handleBlockType"
        @insert="handleInsertImage"
        @gen-image="handleGenImage"
        @select-version="onSwitchVersion"
        @remove-version="onRemoveVersion"
      />
      <article-editor
        v-if="activeEntry"
        ref="editorRef"
        :key="editorKey"
        :content="content"
        :editable="!humanizing"
        :base-dir="activeMdDir"
        :assets-dir="assetsDir"
        @change="handleContentChange"
        @image-added="handleImageAdded"
        @image-removed="handleImageRemoved"
        @image-regen="handleImageRegen"
        @selection-change="handleSelectionChange"
        @state-change="handleStateChange"
      />
      <article-doc-actions
        v-if="activeEntry"
        :humanizing="humanizing"
        :words="liveWords"
        :versions="versions"
        :active-version-id="activeVersionId"
        @humanize="handleHumanize"
        @abort="handleAbortHumanize"
        @copy="handleCopy"
        @detect="handleDetect"
        @reveal="handleReveal"
        @compare="handleCompareVersion"
      />
      <t-tabs v-if="activeEntry" v-model="activePanel" class="gzh-aside__panels">
        <t-tab-panel value="layout" label="排版预览">
          <gzh-layout-panel
            class="gzh-aside__panel-body"
            :content="content"
            :md-dir="activeMdDir"
            :disabled="humanizing || !content.trim()"
          />
        </t-tab-panel>
        <t-tab-panel value="qc" label="正文质检">
          <qc-section
            class="gzh-aside__panel-body"
            :title="activeArticle.title"
            :content="content"
            :model="chatModel"
            :disabled="humanizing"
          />
        </t-tab-panel>
      </t-tabs>
    </template>
    <div v-else class="gzh-aside__empty">
      <div class="empty-card">
        <div class="empty-card__title">公众号创作</div>
        <p>在左侧聊天告诉 AI 选题与要求，文章创建后会自动出现在这里。</p>
        <p>
          创作流程：聊选题（可查爆款数据）→ AI 按公众号体裁成稿 → 在此编辑润色 / 去 AI 味 /
          质检 → 排版预览选风格一键复制，粘贴进公众号编辑器。
        </p>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { MessageUtil } from '@/utils/modal'
import { copyText, openUrlByBrowser } from '@/utils/native'
import type { ChatMessage } from '@/domain'
import { useArticleDoc } from '../article/useArticleDoc'
import { useArticleAssist } from '../article/useArticleAssist'
import { useArticleEditorBridge, type ArticleEditorApi } from '../article/useArticleEditorBridge'
import { openVersionDiffDialog } from '../article/components/VersionDiffDialog'
import { articleVersionTitle } from '@/windows/main/modules/tool/components/article/articleTypes'
import { resolveGzhModel } from '@/windows/main/modules/gzh/gzhAi'
import ArticleDocHeader from '../article/components/ArticleDocHeader.vue'
import ArticleToolbar from '../article/components/ArticleToolbar.vue'
import ArticleEditor from '../article/components/ArticleEditor.vue'
import ArticleDocActions from '../article/components/ArticleDocActions.vue'
import GzhLayoutPanel from './components/GzhLayoutPanel.vue'
import QcSection from './components/QcSection.vue'

/** 腾讯朱雀 AI 检测官网（引导用户到官网手动检测） */
const ZHUQUE_DETECT_URL = 'https://matrix.tencent.com/ai-detect/ai_gen_txt'

const props = defineProps<{
  sandbox?: string
  workspace?: string
  /** 窄栏 / 全屏共用同一文档布局，仅宽度随容器变化 */
  fullscreen?: boolean
  /** 聊天消息（质检等 aside 直呼能力按最后一条 user 消息解析当前对话模型） */
  messages?: ChatMessage[]
}>()

/** 流式改写进行中：数据层暂停轮询 / 外部重读，避免覆盖流式内容 */
const suspended = ref(false)

const {
  store,
  articles,
  activeId,
  activeArticle,
  activeType,
  activeEntry,
  versions,
  activeVersionId,
  content,
  activeMdDir,
  assetsDir,
  selectArticle,
  selectType,
  handleContentChange,
  handleSwitchVersion,
  handleRemoveVersion,
  patchType,
  patchArticle,
  handleReveal,
  flushSave,
  handleRefresh
} = useArticleDoc(props, suspended)

const {
  humanizing,
  streamingVersionId,
  handleHumanize,
  handleAbortHumanize,
  onSwitchVersion,
  onRemoveVersion,
  guardAction
} = useArticleAssist({
  store,
  activeId,
  activeArticle,
  activeType,
  content,
  flushSave,
  switchVersion: handleSwitchVersion,
  removeVersion: handleRemoveVersion
})

watch(humanizing, (v) => (suspended.value = v), { immediate: true })

const editorKey = computed(() => `${activeId.value}:${activeType.value}:${activeVersionId.value}`)
const liveWords = computed(() => content.value.replace(/\s+/g, '').length)

/** 当前对话模型（质检直呼用）：最后一条 user 消息的 provide/model */
const chatModel = computed(() => resolveGzhModel(props.messages ?? []))

/** gzh 能力面板：排版预览 / 正文质检 */
const activePanel = ref<'layout' | 'qc'>('layout')

// ─── 编辑器接线（命令 / 选区 / 状态快照 / 图片登记与生图） ───────────
const editorRef = useTemplateRef<ArticleEditorApi>('editorRef')
const {
  selection,
  editorState,
  handleSelectionChange,
  handleStateChange,
  handleCommand,
  handleBlockType,
  handleImageAdded,
  handleImageRemoved,
  handleInsertImage,
  handleGenImage,
  handleImageRegen
} = useArticleEditorBridge({
  editorRef,
  activeArticle,
  activeEntry,
  patchType,
  activeMdDir,
  assetsDir
})

// ─── AI 检测 / 复制 / 版本对比 ───────────────────────────────────

const handleDetect = async (): Promise<void> => {
  if (content.value) {
    await copyText(content.value)
    window.preload.inject.notification.show('正文内容已复制')
  }
  openUrlByBrowser(ZHUQUE_DETECT_URL)
}

const handleCopy = async (): Promise<void> => {
  if (!content.value) return
  await copyText(content.value)
  MessageUtil.success('正文已复制到剪贴板')
}

const handleCompareVersion = async (versionId: string): Promise<void> => {
  const target = versions.value.find((v) => v.id === versionId)
  const current = versions.value.find((v) => v.id === activeVersionId.value)
  if (!target || !current) return
  try {
    const targetContent = await store.value.readArticle(versionId)
    openVersionDiffDialog({
      currentLabel: articleVersionTitle(current),
      targetLabel: articleVersionTitle(target),
      currentContent: content.value,
      targetContent
    })
  } catch (e) {
    MessageUtil.error('读取版本正文失败', e)
  }
}
</script>
<style scoped lang="less">
.gzh-aside {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding-left: 8px;
  &.fullscreen {
    padding: 0 8px 8px;
  }
  :deep(.doc-header),
  :deep(.doc-toolbar),
  :deep(.doc-actions) {
    flex-shrink: 0;
  }
}

.gzh-aside__panels {
  flex-shrink: 0;
  height: 320px;
  display: flex;
  flex-direction: column;
  margin-top: 4px;
  :deep(.t-tabs__content) {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
}

.gzh-aside__panel-body {
  height: 100%;
}

.gzh-aside__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.empty-card {
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--td-text-color-placeholder);
  font-size: var(--td-font-size-body-small);
  line-height: 1.8;

  &__title {
    font-size: var(--td-font-size-title-medium);
    font-weight: 600;
    color: var(--td-text-color-secondary);
  }

  p {
    margin: 0;
  }
}
</style>
