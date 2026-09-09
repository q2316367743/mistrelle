<template>
  <div class="article-aside">
    <article-aside-header
      :articles="articles"
      :active-id="activeId"
      :export-disabled="!activeArticle || exporting"
      @select="handleSelectChange"
      @reveal="handleReveal"
      @refresh="handleRefresh"
      @export="handleExport"
    />

    <!-- 窄栏布局：正文 / 配图 / 风格 分段切换 -->
    <t-radio-group
      v-if="!fullscreen"
      class="article-aside__tabs"
      variant="default-filled"
      :value="activeTab"
      @change="(v: unknown) => typeof v === 'string' && (activeTab = v as ArticleAsideTab)"
    >
      <t-radio-button value="content">正文</t-radio-button>
      <t-radio-button value="image">配图</t-radio-button>
      <t-radio-button value="style">风格</t-radio-button>
    </t-radio-group>

    <template v-if="!fullscreen">
      <div class="article-aside__body">
        <template v-if="activeArticle">
          <article-editor
            v-show="activeTab === 'content'"
            ref="editorRef"
            :key="activeId"
            :content="content"
            :mode="mode"
            :base-dir="activeMdDir"
            :assets-dir="assetsDir"
            @change="handleContentChange"
            @image-added="handleImageAdded"
          />
          <article-image-panel
            v-if="activeTab === 'image'"
            :article="activeArticle"
            :root="root"
            :assets-dir="assetsDir"
            @cover="handleCover"
            @add-images="handleAddImages"
            @remove-image="handleRemoveImage"
            @insert="handleInsertImage"
          />
          <article-style-panel
            v-if="activeTab === 'style'"
            :article="activeArticle"
            @patch="patchArticle"
            @rewrite="handleRewrite"
          />
        </template>
        <div v-else class="article-aside__empty">{{ emptyHint }}</div>
      </div>
    </template>

    <!-- 全屏布局：左正文编辑 + 右创作面板常驻 -->
    <div v-else class="article-aside__split">
      <div class="article-aside__main">
        <article-editor
          v-if="activeArticle"
          ref="editorRef"
          :key="activeId"
          :content="content"
          :mode="mode"
          :base-dir="activeMdDir"
          :assets-dir="assetsDir"
          @change="handleContentChange"
          @image-added="handleImageAdded"
        />
        <div v-else class="article-aside__empty">{{ emptyHint }}</div>
      </div>
      <div class="article-aside__side">
        <template v-if="activeArticle">
          <article-image-panel
            :article="activeArticle"
            :root="root"
            :assets-dir="assetsDir"
            @cover="handleCover"
            @add-images="handleAddImages"
            @remove-image="handleRemoveImage"
            @insert="handleInsertImage"
          />
          <article-style-panel
            :article="activeArticle"
            @patch="patchArticle"
            @rewrite="handleRewrite"
          />
        </template>
        <div v-else class="article-aside__empty">{{ emptyHint }}</div>
      </div>
    </div>

    <article-aside-footer :class="[{ 'mb-8px': fullscreen }]" />
  </div>
</template>
<script lang="ts" setup>
import type { ArticleUpdatePatch } from '@/windows/main/modules/tool/components/article/articleTypes'
import { MessageUtil } from '@/utils/modal'
import { PROMPT_INPUT_KEY } from './promptInputBridge'
import { useArticleDoc } from './useArticleDoc'
import ArticleAsideHeader from './components/ArticleAsideHeader.vue'
import ArticleAsideFooter from './components/ArticleAsideFooter.vue'
import ArticleEditor from './components/ArticleEditor.vue'
import ArticleImagePanel from './components/ArticleImagePanel.vue'
import ArticleStylePanel from './components/ArticleStylePanel.vue'

/** 侧边栏分段（窄栏布局） */
type ArticleAsideTab = 'content' | 'image' | 'style'

const props = defineProps<{
  sandbox?: string
  workspace?: string
  /** 侧边栏全屏：全屏=左编辑器+右创作面板分栏；窄栏=分段切换，非全屏仅预览 */
  fullscreen?: boolean
}>()

const {
  root,
  store,
  articles,
  mode,
  activeId,
  activeArticle,
  content,
  exporting,
  activeMdDir,
  assetsDir,
  handleSelectChange,
  handleContentChange,
  handleReveal,
  handleRefresh,
  handleExport
} = useArticleDoc(props)

const activeTab = ref<ArticleAsideTab>('content')
const editorRef = ref<{ insertImage: (rel: string) => void } | null>(null)
const promptInput = inject(PROMPT_INPUT_KEY)

const emptyHint = computed(() => {
  if (activeTab.value === 'image') return '先选择文章，再管理封面与插图'
  if (activeTab.value === 'style') return '先选择文章，再设置写作风格'
  return '从上方选择文章，或让 AI 生成文章后在此选择'
})

// =================================== 配图 / 风格面板事件（写回共享 store） ===================================

const patchArticle = (patch: ArticleUpdatePatch) => {
  if (!activeArticle.value) return
  store.value
    .updateArticle(activeId.value, patch)
    .catch(() => MessageUtil.error('文章信息保存失败'))
}

/** 编辑器粘贴 / 拖入的图片自动登记进插图列表（去重；编辑器内为相对 md 目录路径，登记归一为相对 articles/） */
const handleImageAdded = (rel: string) => {
  const article = activeArticle.value
  if (!article) return
  const target = `assets/${window.preload.path.basename(rel)}`
  if ((article.images ?? []).includes(target)) return
  patchArticle({ images: [...(article.images ?? []), target] })
}

const handleAddImages = (rels: string[]) => {
  const article = activeArticle.value
  if (!article) return
  const merged = [...(article.images ?? [])]
  for (const rel of rels) if (!merged.includes(rel)) merged.push(rel)
  patchArticle({ images: merged })
}

const handleRemoveImage = (rel: string) => {
  const article = activeArticle.value
  if (!article) return
  patchArticle({ images: (article.images ?? []).filter((img) => img !== rel) })
}

const handleCover = (rel: string | undefined) => patchArticle({ cover: rel })

/** 插图插入正文光标处：窄栏先切回正文分段，等编辑器可见后再插入 */
const handleInsertImage = (rel: string) => {
  activeTab.value = 'content'
  void nextTick(() => editorRef.value?.insertImage(rel))
}

/** 快捷指令：按当前平台 / 风格重写正文（填入聊天输入框，不自动发送） */
const handleRewrite = () => {
  const article = activeArticle.value
  if (!article) return
  const styleText = article.style ? `「${article.style}」风格` : '平台惯用风格'
  promptInput?.(
    [
      `请把《${article.title}》正文重写为 ${article.platform} 平台${styleText}：`,
      '保持选题与核心信息不变，按该平台与风格调整标题、开头、结构与语气；',
      `完成后覆盖写入正文文件 ${article.file}，并用 article_stats 统计字数。`
    ].join('')
  )
  MessageUtil.success('指令已填入聊天输入框，可修改后发送')
}
</script>
<style scoped lang="less">
.article-aside {
  height: calc(100% - 8px);
  display: flex;
  flex-direction: column;
  padding: 8px 0 8px 8px;

  &__tabs {
    margin-top: 8px;
    width: 100%;
    display: flex;

    :deep(.t-radio-button) {
      flex: 1;
    }
  }

  &__body {
    margin-top: 8px;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-radius: var(--td-radius-medium);
    border: 1px solid var(--td-border-level-1-color);
    overflow: hidden;
  }

  &__split {
    margin-top: 8px;
    flex: 1;
    min-height: 0;
    display: flex;
    border-radius: var(--td-radius-medium);
    border: 1px solid var(--td-border-level-1-color);
    overflow: hidden;
  }

  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
  }

  &__side {
    width: 300px;
    flex-shrink: 0;
    border-left: 1px solid var(--td-border-level-1-color);
    overflow-y: auto;
    background: var(--td-bg-color-container);
  }

  &__empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--td-text-color-placeholder);
    font-size: var(--td-font-size-body-small);
  }
}
</style>
<style lang="less">
/* 自定义 select 下拉选项面板（teleport 到 body，需全局样式；类名见 popup-props.overlayClassName） */
.article-select-overlay {
  .t-select-option {
    height: 100%;
    padding: 8px;
  }
}
</style>
