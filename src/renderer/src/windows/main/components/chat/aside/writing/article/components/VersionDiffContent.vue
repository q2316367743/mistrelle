<template>
  <div class="version-diff">
    <div class="version-diff__labels">
      <span :title="currentLabel" class="version-diff__label">{{ currentLabel }}</span>
      <span :title="targetLabel" class="version-diff__label">{{ targetLabel }}</span>
    </div>
    <div ref="diffEl" class="version-diff__editor"></div>
    <div class="version-diff__footer">
      <t-button size="small" variant="outline" @click="emit('close')">关闭</t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import * as monaco from 'monaco-editor'
import { isDark } from '@/global/BeanFactory'
import { wordDiffTheme } from './wordDiffTheme'

const props = defineProps<{
  /** 左侧（当前版本）标题 */
  currentLabel: string
  /** 右侧（所选版本）标题 */
  targetLabel: string
  /** 当前版本正文 */
  currentContent: string
  /** 所选版本正文 */
  targetContent: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const diffEl = ref<HTMLDivElement>()
let diffEditor: monaco.editor.IStandaloneDiffEditor | null = null
let originalModel: monaco.editor.ITextModel | null = null
let modifiedModel: monaco.editor.ITextModel | null = null

onMounted(() => {
  if (!diffEl.value) return
  diffEditor = monaco.editor.createDiffEditor(diffEl.value, {
    readOnly: true,
    originalEditable: false,
    renderSideBySide: true,
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: 'on',
    scrollBeyondLastLine: false
  })
  // monaco 约定 original 左、modified 右：左=当前版本、右=所选版本
  originalModel = monaco.editor.createModel(props.currentContent, 'markdown')
  modifiedModel = monaco.editor.createModel(props.targetContent, 'markdown')
  diffEditor.setModel({ original: originalModel, modified: modifiedModel })
  // 主题是 monaco 全局态：diff 编辑器选项不含 theme，用 setTheme 生效
  monaco.editor.setTheme(wordDiffTheme(isDark.value))
})

watch(isDark, (v) => monaco.editor.setTheme(wordDiffTheme(v)))

onBeforeUnmount(() => {
  diffEditor?.dispose()
  originalModel?.dispose()
  modifiedModel?.dispose()
  diffEditor = null
  originalModel = null
  modifiedModel = null
  // 还原全局主题，避免行背景透明的 diff 主题影响后续 diff 场景
  monaco.editor.setTheme(isDark.value ? 'vs-dark' : 'vs')
})
</script>
<style scoped lang="less">
.version-diff {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__labels {
    display: flex;
    gap: 16px;
  }

  &__label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-secondary);
    font-weight: 600;
  }

  &__editor {
    height: 62vh;
    border: 1px solid var(--td-border-level-1-color);
    border-radius: var(--td-radius-medium);
    overflow: hidden;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
  }
}
</style>
