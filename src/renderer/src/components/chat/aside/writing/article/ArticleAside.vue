<template>
  <div class="article-aside" :class="{ fullscreen: fullscreen }">
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
        @format="handleFormat"
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
        @selection-change="(text: string) => (selection = text)"
      />
      <article-doc-actions
        v-if="activeEntry"
        :humanizing="humanizing"
        :words="liveWords"
        @humanize="handleHumanize"
        @abort="handleAbortHumanize"
        @copy="handleCopy"
        @detect="handleDetect"
        @reveal="handleReveal"
      />
      <div v-if="!activeEntry" class="article-aside__hint">
        当前文章还没有类型，在左侧聊天让 AI 设定类型（如公众号、知乎、小红书等）即可开始写作。
      </div>
    </template>
    <div v-else class="article-aside__empty">
      <div class="empty-card">
        <div class="empty-card__title">开始写作</div>
        <p>在左侧聊天告诉 AI 选题与要求，文章创建后会自动出现在这里。</p>
        <p>
          写作流程：聊天确定选题与大纲 → AI 生成初稿 → 在此直接编辑润色 → 去 AI 味 / AI 重写 →
          配图。一篇文章可为公众号、知乎、小红书等多个类型各写一版，互不干扰。
        </p>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { MessageUtil } from '@/utils/modal'
import { copyText, openUrlByBrowser } from '@/utils/native'
import { resolveAssetRel } from '@/windows/main/modules/tool/components/article/imageRef'
import type { ImagePromptContext } from '@/windows/main/modules/tool/components/writing/imagePrompt'
import { useArticleDoc } from './useArticleDoc'
import { useArticleAssist } from './useArticleAssist'
import ArticleDocHeader from './components/ArticleDocHeader.vue'
import ArticleToolbar from './components/ArticleToolbar.vue'
import ArticleEditor from './components/ArticleEditor.vue'
import ArticleDocActions from './components/ArticleDocActions.vue'
import { openImageGen } from '../components/ImageGenDialog'

/** 腾讯朱雀 AI 检测官网（仅企业接入，这里引导用户到官网手动检测） */
const ZHUQUE_DETECT_URL = 'https://matrix.tencent.com/ai-detect/ai_gen_txt'

/** 编辑器实例命令面（ArticleEditor defineExpose） */
type EditorApi = {
  insertImage: (rel: string) => void
  /** 读取当前选区文本（无选区返回空串） */
  getSelection: () => string
  toggleBold: () => void
  toggleItalic: () => void
  toggleHeading2: () => void
  toggleBulletList: () => void
  toggleBlockquote: () => void
}

const props = defineProps<{
  sandbox?: string
  workspace?: string
  /** 保留入参兼容：窄栏 / 全屏共用同一文档布局，仅宽度随容器变化 */
  fullscreen?: boolean
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

/** 去 AI 味动作编排 */
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

const editorRef = ref<EditorApi | null>(null)
/** 编辑器当前选中的正文文本（空 = 未选中，插图生图禁用） */
const selection = ref('')

const editorKey = computed(() => `${activeId.value}:${activeType.value}:${activeVersionId.value}`)
const liveWords = computed(() => content.value.replace(/\s+/g, '').length)

// ─── 编辑器格式与配图 ─────────────────────────────────────────────

type ArticleFormatCmd = 'bold' | 'italic' | 'h2' | 'bulletList' | 'blockquote'

const handleFormat = (cmd: ArticleFormatCmd): void => {
  const ed = editorRef.value
  if (!ed) return
  if (cmd === 'bold') ed.toggleBold()
  else if (cmd === 'italic') ed.toggleItalic()
  else if (cmd === 'h2') ed.toggleHeading2()
  else if (cmd === 'bulletList') ed.toggleBulletList()
  else if (cmd === 'blockquote') ed.toggleBlockquote()
}

/** 编辑器相对 md 目录的图片引用 → 归一为相对 articles/ 登记进当前类型插图列表（去重） */
const registerImage = (rel: string): void => {
  const entry = activeEntry.value
  if (!entry) return
  const target = `assets/${window.preload.path.basename(rel)}`
  if ((entry.images ?? []).includes(target)) return
  patchType({ images: [...(entry.images ?? []), target] })
}

const handleImageAdded = (rel: string): void => registerImage(rel)

const handleInsertImage = (rel: string): void => {
  editorRef.value?.insertImage(rel)
  registerImage(rel)
}

/**
 * 插图语境：以**用户选中的文字**为核心（要插图的正是这段内容），另附文章标题 / 摘要 / 提纲作背景。
 * 刻意不传正文全文——会让模型画成泛泛的「全文配图」而非这一段。无选中时按钮本就禁用，不会走到这里。
 */
const buildImageContext = (): ImagePromptContext => {
  const article = activeArticle.value
  return {
    title: article?.title,
    summary: article?.summary,
    outline: article?.outline,
    selection: selection.value || editorRef.value?.getSelection() || undefined
  }
}

/** AI 生成插图：产物落 assets/ 后插入光标处并登记 */
const handleGenImage = (): void => {
  if (!activeEntry.value) return
  openImageGen({
    kind: 'image',
    assetsDir: assetsDir.value,
    context: buildImageContext(),
    onSuccess: (absPath) => {
      const rel = resolveAssetRel(activeMdDir.value, absPath)
      handleInsertImage(rel)
    }
  })
}

// ─── AI 检测 / 复制 ───────────────────────────────────────────────

/** AI 检测：先复制正文并系统通知，再打开朱雀官网由默认浏览器检测 */
const handleDetect = async (): Promise<void> => {
  if (content.value) {
    await copyText(content.value)
    window.preload.inject.notification.show('正文内容已复制')
  }
  openUrlByBrowser(ZHUQUE_DETECT_URL)
}

/** 复制当前类型激活版本正文（markdown 原文）到剪贴板 */
const handleCopy = async (): Promise<void> => {
  if (!content.value) return
  await copyText(content.value)
  MessageUtil.success('正文已复制到剪贴板')
}
</script>
<style scoped lang="less">
.article-aside {
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

.article-aside__hint {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  text-align: center;
  color: var(--td-text-color-placeholder);
  font-size: var(--td-font-size-body-small);
  line-height: 1.8;
}

.article-aside__empty {
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
