<template>
  <div class="xhs-text">
    <div class="xhs-text__meta">
      <t-select
        v-if="articles.length > 1"
        :value="activeId"
        :options="articleOptions"
        size="small"
        class="xhs-text__pick"
        @change="onArticleChange"
      />
      <t-select
        v-if="versions.length > 1"
        :value="activeVersionId"
        :options="versionOptions"
        size="small"
        class="xhs-text__pick xhs-text__pick--version"
        @change="onVersionChange"
      />
    </div>
    <div v-if="!activeEntry" class="xhs-text__hint">
      还没有正文。让左侧聊天里的 AI 写好发布文案，或直接在这里起草——小红书不支持 Markdown，
      这里编辑的就是最终要复制发布的纯文本。
    </div>
    <div ref="editorEl" class="xhs-text__editor"></div>
    <div class="xhs-text__footer">
      <span class="xhs-text__count">{{ words }} 字</span>
      <span class="xhs-text__state">{{ dirty ? '保存中…' : '已自动保存' }}</span>
      <div class="xhs-text__spacer" />
      <t-button size="small" variant="outline" :disabled="!content" @click="handleCopy">
        <template #icon><copy-icon /></template>
        复制正文
      </t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import * as monaco from 'monaco-editor'
import { CopyIcon } from 'tdesign-icons-vue-next'
import { isDark } from '@/global/BeanFactory'
import { copyText } from '@/utils/native'
import { MessageUtil } from '@/utils/modal'
import { articleVersionTitle } from '@/windows/main/modules/tool/components/article/articleTypes'
import { useArticleDoc } from '../../article/useArticleDoc'

/**
 * 小红书正文 tab：直接编辑发布文案**源码**，不做 Markdown 渲染——小红书不支持
 * Markdown，渲染层只会掩盖真正要复制发布的内容。数据仍走文章工作台（与 AI 的
 * article_write 共享同一 store，AI 写入 / 多版本切换实时反映到编辑器）。
 * 多篇 / 多版本时才出现切换下拉，单篇默认零干扰。
 */
const props = defineProps<{
  sandbox?: string
  workspace?: string
}>()

const {
  articles,
  activeId,
  activeEntry,
  versions,
  activeVersionId,
  content,
  dirty,
  selectArticle,
  handleSwitchVersion,
  handleContentChange
} = useArticleDoc(props)

const words = computed(() => content.value.replace(/\s+/g, '').length)
const articleOptions = computed(() =>
  articles.value.map((a) => ({ label: a.title || a.id, value: a.id }))
)
const versionOptions = computed(() =>
  versions.value.map((v) => ({ label: articleVersionTitle(v), value: v.id }))
)

const editorEl = ref<HTMLDivElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let model: monaco.editor.ITextModel | null = null
/** 外部内容回填编辑器中（setValue 会同步触发 onChange，避免把回填当成用户输入再存一遍） */
let applyingExternal = false

onMounted(() => {
  if (!editorEl.value) return
  model = monaco.editor.createModel(content.value, 'markdown')
  editor = monaco.editor.create(editorEl.value, {
    model,
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    fontSize: 13,
    tabSize: 2
  })
  monaco.editor.setTheme(isDark.value ? 'vs-dark' : 'vs')
  editor.onDidChangeModelContent(() => {
    if (applyingExternal) return
    handleContentChange(editor?.getValue() ?? '')
  })
})

watch(isDark, (v) => monaco.editor.setTheme(v ? 'vs-dark' : 'vs'))

/** AI 写入 / 切换笔记与版本 → 内容同步进编辑器（本地输入时两者已相等，天然跳过） */
watch(content, (value) => {
  if (!editor || editor.getValue() === value) return
  const scrollTop = editor.getScrollTop()
  applyingExternal = true
  editor.setValue(value)
  applyingExternal = false
  editor.setScrollTop(scrollTop)
})

onBeforeUnmount(() => {
  editor?.dispose()
  model?.dispose()
  editor = null
  model = null
})

const onArticleChange = (value: unknown): void => {
  if (typeof value === 'string') void selectArticle(value)
}

const onVersionChange = (value: unknown): void => {
  if (typeof value === 'string') void handleSwitchVersion(value)
}

const handleCopy = async (): Promise<void> => {
  if (!content.value) return
  await copyText(content.value)
  MessageUtil.success('正文已复制到剪贴板')
}
</script>
<style scoped lang="less">
.xhs-text {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-left: 6px;

  &__meta {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__title {
    flex: 1;
    min-width: 0;
    font: var(--td-font-body-small);
    font-weight: 600;
    color: var(--td-text-color-primary);
    margin-top: 4px;
    margin-left: 8px;
  }

  &__pick {
    flex: 1;
    min-width: 0;

    &--version {
      flex: 0 0 auto;
      max-width: 45%;
    }
  }

  &__hint {
    flex-shrink: 0;
    padding: 8px;
    border-radius: var(--td-radius-medium);
    border: 1px solid var(--td-border-level-1-color);
    font: var(--td-font-body-small);
    line-height: 1.7;
    color: var(--td-text-color-secondary);
  }

  &__editor {
    flex: 1;
    min-height: 0;
    border: 1px solid var(--td-border-level-1-color);
    border-radius: var(--td-radius-medium);
    overflow: hidden;
  }

  &__footer {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__count,
  &__state {
    flex-shrink: 0;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
    font-variant-numeric: tabular-nums;
  }

  &__spacer {
    flex: 1;
  }
}
</style>
