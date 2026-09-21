<template>
  <div class="fmt">
    <!-- 块类型：随光标联动，放标题上显示标题等级、放正文显示「正文」；
         宽度不足时收进「更多」面板（此时这里不渲染） -->
    <template v-if="inlineBlockType">
      <t-select
        class="fmt__block"
        size="small"
        :value="state.blockType"
        :options="ArticleBlockTypeOptions"
        :disabled="disabled"
        @change="(v) => emit('block-type', v as ArticleBlockType)"
      />
      <span v-if="inlineButtons.length" class="fmt__sep" />
    </template>

    <!-- 内联按钮（数量由工具栏按可用宽度算出，从前往后取） -->
    <template v-for="(btn, index) in inlineButtons" :key="btn.cmd">
      <t-tooltip :content="btn.tip">
        <t-button
          size="small"
          variant="text"
          shape="square"
          :class="{ 'is-active': readCommandActive(state, btn.cmd) }"
          :disabled="disabled || !readCommandEnabled(state, btn.cmd)"
          @click="emit('command', btn.cmd)"
        >
          <template #icon><component :is="btn.icon" /></template>
        </t-button>
      </t-tooltip>
      <span v-if="index === inlineButtons.length - 1 && hasOverflow" class="fmt__sep" />
    </template>

    <!-- 溢出入口：装不下的格式按钮 / 块类型 / 插图生图都在面板里 -->
    <t-popup
      v-if="hasOverflow"
      v-model:visible="panelVisible"
      trigger="click"
      placement="bottom-right"
      destroy-on-close
    >
      <t-tooltip content="更多格式">
        <t-button size="small" variant="text" shape="square" :disabled="disabled">
          <template #icon><EllipsisIcon /></template>
        </t-button>
      </t-tooltip>
      <template #content>
        <article-format-panel
          :state="state"
          :disabled="disabled"
          :show-block-type="!inlineBlockType"
          :show-images="showImagesInPanel"
          :overflow-cmds="overflowCmds"
          :has-selection="hasSelection"
          :gen-image-tip="genImageTip"
          @command="(cmd) => emit('command', cmd)"
          @block-type="(type) => emit('block-type', type)"
          @upload-image="emit('upload-image')"
          @gen-image="emit('gen-image')"
        />
      </template>
    </t-popup>
  </div>
</template>
<script lang="ts" setup>
import { computed, ref } from 'vue'
import { EllipsisIcon } from 'tdesign-icons-vue-next'
import {
  ArticleBlockTypeOptions,
  readCommandActive,
  readCommandEnabled,
  type ArticleBlockType,
  type ArticleEditorCommand,
  type ArticleEditorState
} from './articleEditorCommands'
import type { ArticleFormatButton } from './articleFormatButtons'
import ArticleFormatPanel from './ArticleFormatPanel.vue'

const props = defineProps<{
  /** 编辑器状态快照（由 ArticleEditor 推送） */
  state: ArticleEditorState
  /** 流式改写等期间整体禁用 */
  disabled?: boolean
  /** 块类型下拉是否内联（否则进「更多」面板） */
  inlineBlockType: boolean
  /** 内联展示的按钮（工具栏按可用宽度算好，顺序即优先级） */
  inlineButtons: ArticleFormatButton[]
  /** 未内联的按钮命令（交给「更多」面板渲染，避免重复出现） */
  overflowCmds: ArticleEditorCommand[]
  /** 插图 / 生图是否未内联 */
  showImagesInPanel: boolean
  /** 编辑器是否有选中文字（面板内生图按钮的门控） */
  hasSelection?: boolean
  /** 生图可用性提示文案 */
  genImageTip: string
}>()

const emit = defineEmits<{
  (e: 'command', cmd: ArticleEditorCommand): void
  (e: 'block-type', type: ArticleBlockType): void
  (e: 'upload-image'): void
  (e: 'gen-image'): void
}>()

const panelVisible = ref(false)

/** 是否有内容被收进面板：三者任一为真才显示「更多」按钮 */
const hasOverflow = computed(
  () => !props.inlineBlockType || props.overflowCmds.length > 0 || props.showImagesInPanel
)
</script>
<style scoped lang="less">
.fmt {
  display: flex;
  align-items: center;
  gap: 2px;
  /* 恒为一行：溢出由 JS 按宽度收进「更多」，此处不再换行 */
  flex-wrap: nowrap;
  min-width: 0;

  &__block {
    /* 宽度与 articleFormatButtons.ts 的 BLOCK_TYPE_WIDTH 保持一致（布局预算据此计算） */
    width: 68px;
    flex-shrink: 0;
  }

  &__sep {
    width: 1px;
    height: 16px;
    margin: 0 4px;
    flex-shrink: 0;
    background: var(--td-border-level-1-color);
  }

  :deep(.t-button.is-active) {
    color: var(--td-brand-color);
    background: var(--td-brand-color-light);
  }
}
</style>
