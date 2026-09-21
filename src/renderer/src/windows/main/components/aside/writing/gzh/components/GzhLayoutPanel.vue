<template>
  <div class="layout-panel">
    <div class="layout-panel__bar">
      <t-select
        v-model="styleId"
        size="small"
        class="layout-panel__select"
        :clearable="false"
        :disabled="disabled"
      >
        <t-option
          v-for="style in store.all"
          :key="style.id"
          :value="style.id"
          :label="style.name"
          :description="style.description"
        />
      </t-select>
      <t-button
        size="small"
        theme="primary"
        :disabled="disabled || !previewDoc"
        :loading="copying"
        @click="handleCopy"
      >
        复制排版
      </t-button>
    </div>
    <div class="layout-panel__preview">
      <iframe
        v-if="previewDoc"
        class="layout-panel__frame"
        :srcdoc="previewDoc"
        sandbox="allow-same-origin"
        title="公众号排版预览"
      />
      <div v-else-if="content.trim()" class="layout-panel__loading">排版生成中…</div>
      <div v-else class="layout-panel__empty">正文写好后这里实时预览排版效果</div>
    </div>
    <div class="layout-panel__tip">复制后直接粘贴进公众号编辑器（样式全内联）</div>
  </div>
</template>
<script lang="ts" setup>
import { debounce } from 'es-toolkit'
import { MessageUtil } from '@/utils/modal'
import { useGzhStyleStore } from '@/windows/main/store/gzh/GzhStyleStore'
import { renderGzhLayout } from '@/windows/main/modules/gzh/gzhLayoutRender'
import {
  buildGzhPreviewDoc,
  copyGzhLayoutToClipboard,
  resolveGzhLayoutImages
} from '@/windows/main/modules/gzh/gzhLayoutPipeline'

const props = defineProps<{
  /** 当前正文（Markdown 原文） */
  content: string
  /** 正文 md 所在目录（图片相对路径解析基准） */
  mdDir: string
  /** true 时禁用（无正文 / 流式改写中） */
  disabled?: boolean
}>()

const store = useGzhStyleStore()
const styleId = ref('')
const previewDoc = ref('')
const copying = ref(false)

/** 默认选中首个内置预设（store 异步初始化后 all 恒非空） */
watch(
  () => store.all.length,
  () => {
    if (!styleId.value && store.all.length) styleId.value = store.all[0].id
  },
  { immediate: true }
)

const activeStyle = computed(() => store.getById(styleId.value))

/** 排版装配：渲染 + 图片 dataURL 化（防抖跟随正文与风格变化） */
const rebuild = async (): Promise<void> => {
  const style = activeStyle.value
  if (!style || !props.content.trim()) {
    previewDoc.value = ''
    return
  }
  const fragment = renderGzhLayout(props.content, style.styles, style.id)
  previewDoc.value = await buildGzhPreviewDoc(fragment, props.mdDir)
}

const rebuildDebounced = debounce(() => void rebuild(), 500)

watch([() => props.content, activeStyle, () => props.mdDir], () => rebuildDebounced(), {
  immediate: true
})

/** 复制排版：图片解析后的完整片段 + Markdown 原文双写剪贴板 */
const handleCopy = async (): Promise<void> => {
  const style = activeStyle.value
  if (!style || !props.content.trim()) return
  copying.value = true
  try {
    const fragment = renderGzhLayout(props.content, style.styles, style.id)
    const resolved = await resolveGzhLayoutImages(fragment, props.mdDir)
    await copyGzhLayoutToClipboard(resolved, props.content)
    MessageUtil.success('排版已复制，去公众号编辑器粘贴即可')
  } catch (e) {
    MessageUtil.error('复制失败', e)
  } finally {
    copying.value = false
  }
}
</script>
<style scoped lang="less">
.layout-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;

  &__bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  &__select {
    flex: 1;
  }

  &__preview {
    flex: 1;
    min-height: 180px;
    border: 1px solid var(--td-component-border);
    border-radius: var(--td-radius-medium);
    overflow: hidden;
    background: var(--td-bg-color-container);
  }

  &__frame {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
  }

  &__loading,
  &__empty {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
    text-align: center;
    padding: 0 16px;
  }

  &__tip {
    flex-shrink: 0;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
    text-align: center;
  }
}
</style>
