<template>
  <div class="sel-humanize">
    <div class="sel-humanize__labels">
      <span class="sel-humanize__label">选中原文</span>
      <span class="sel-humanize__label">改写结果</span>
    </div>
    <div ref="diffEl" class="sel-humanize__editor" :style="{ height: diffHeight }"></div>
    <div class="sel-humanize__footer">
      <span class="sel-humanize__hint">取消将丢弃本次改写结果（已消耗的积分不予退还）</span>
      <div class="sel-humanize__btns">
        <t-button size="small" variant="outline" @click="emit('cancel')">取消</t-button>
        <t-button size="small" theme="primary" @click="emit('replace')">替换</t-button>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import * as monaco from 'monaco-editor'
import { isDark } from '@/global/BeanFactory'
import { wordDiffTheme } from './wordDiffTheme'

const props = defineProps<{
  /** 选中原文（左栏） */
  original: string
  /** 去 AI 味改写结果（右栏） */
  result: string
}>()

const emit = defineEmits<{
  (e: 'replace'): void
  (e: 'cancel'): void
}>()

const diffEl = ref<HTMLDivElement>()
let diffEditor: monaco.editor.IStandaloneDiffEditor | null = null
let originalModel: monaco.editor.ITextModel | null = null
let modifiedModel: monaco.editor.ITextModel | null = null

/** 片段对比高度随内容行数伸缩（200px 下限，40vh 上限），避免短文本大片留白 */
const diffHeight = computed(() => {
  const lines = Math.max(props.original.split('\n').length, props.result.split('\n').length)
  return `min(40vh, ${Math.max(200, lines * 22 + 28)}px)`
})

onMounted(() => {
  if (!diffEl.value) return
  diffEditor = monaco.editor.createDiffEditor(diffEl.value, {
    readOnly: true,
    originalEditable: false,
    renderSideBySide: true,
    // monaco 在宽度低于断点（默认 900px）时会自动退化成上下 inline 对比，
    // 置 0 强制始终左右分栏（片段弹窗 ≤960px，否则永远看不到左右对比）
    renderSideBySideInlineBreakpoint: 0,
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: 'on',
    scrollBeyondLastLine: false
  })
  // monaco 约定 original 左、modified 右：左=选中原文、右=改写结果
  originalModel = monaco.editor.createModel(props.original, 'markdown')
  modifiedModel = monaco.editor.createModel(props.result, 'markdown')
  diffEditor.setModel({ original: originalModel, modified: modifiedModel })
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
.sel-humanize {
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
    border: 1px solid var(--td-border-level-1-color);
    border-radius: var(--td-radius-medium);
    overflow: hidden;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__hint {
    min-width: 0;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__btns {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
}
</style>
