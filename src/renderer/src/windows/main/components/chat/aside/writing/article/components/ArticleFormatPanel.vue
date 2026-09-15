<template>
  <div class="fmt-panel">
    <!-- 块类型：仅当工具栏内联放不下时出现在此处 -->
    <div v-if="showBlockType" class="fmt-panel__section">
      <div class="fmt-panel__label">块类型</div>
      <t-select
        size="small"
        :value="state.blockType"
        :options="ArticleBlockTypeOptions"
        :disabled="disabled"
        style="width: 100%"
        @change="(v) => emit('block-type', v as ArticleBlockType)"
      />
    </div>

    <!-- 溢出的格式按钮，按组展示 -->
    <div v-for="group in groupedButtons" :key="group.key" class="fmt-panel__section">
      <div class="fmt-panel__label">{{ group.label }}</div>
      <div class="fmt-panel__grid">
        <t-tooltip v-for="btn in group.items" :key="btn.cmd" :content="btn.tip" placement="top">
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
      </div>
    </div>

    <!-- 插图 / 生图：仅当工具栏内联放不下时出现在此处 -->
    <div v-if="showImages" class="fmt-panel__section">
      <div class="fmt-panel__label">插入</div>
      <div class="fmt-panel__grid">
        <t-tooltip content="插图（上传本地图片）" placement="top">
          <t-button
            size="small"
            variant="text"
            shape="square"
            :disabled="disabled"
            @click="emit('upload-image')"
          >
            <template #icon><ImageAddIcon /></template>
          </t-button>
        </t-tooltip>
        <t-tooltip :content="genImageTip" placement="top">
          <t-button
            size="small"
            variant="text"
            shape="square"
            :disabled="disabled || !canGenerate || !hasSelection"
            @click="emit('gen-image')"
          >
            <template #icon><AiImageIcon /></template>
          </t-button>
        </t-tooltip>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { computed } from 'vue'
import { AiImageIcon, ImageAddIcon } from 'tdesign-icons-vue-next'
import { useAuthStore } from '@/windows/main/store/AuthStore'
import {
  ArticleBlockTypeOptions,
  readCommandActive,
  readCommandEnabled,
  type ArticleBlockType,
  type ArticleEditorCommand,
  type ArticleEditorState
} from './articleEditorCommands'
import {
  ARTICLE_FORMAT_BUTTONS,
  ArticleFormatGroupLabels,
  type ArticleFormatGroup
} from './articleFormatButtons'

const props = defineProps<{
  state: ArticleEditorState
  /** 流式改写等期间整体禁用 */
  disabled?: boolean
  /** 块类型下拉是否未内联（未内联才在面板显示） */
  showBlockType: boolean
  /** 插图 / 生图是否未内联（未内联才在面板显示） */
  showImages: boolean
  /** 未内联的按钮命令集合（其余已内联，不在面板重复出现） */
  overflowCmds: ArticleEditorCommand[]
  hasSelection?: boolean
  /** 生图可用性提示（沿用工具栏的登录 / 选中态判断） */
  genImageTip: string
}>()

const emit = defineEmits<{
  (e: 'command', cmd: ArticleEditorCommand): void
  (e: 'block-type', type: ArticleBlockType): void
  (e: 'upload-image'): void
  (e: 'gen-image'): void
}>()

const canGenerate = computed(() => useAuthStore().status === 'signed-in')

/** 按组归集未内联的按钮（组内顺序沿用全集顺序，保证与内联区一致） */
const groupedButtons = computed(() => {
  const groups: Array<{
    key: ArticleFormatGroup
    label: string
    items: typeof ARTICLE_FORMAT_BUTTONS
  }> = []
  for (const btn of ARTICLE_FORMAT_BUTTONS) {
    if (!props.overflowCmds.includes(btn.cmd)) continue
    let group = groups.find((g) => g.key === btn.group)
    if (!group) {
      group = { key: btn.group, label: ArticleFormatGroupLabels[btn.group], items: [] }
      groups.push(group)
    }
    group.items.push(btn)
  }
  return groups
})
</script>
<style scoped lang="less">
.fmt-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  min-width: 208px;
  max-width: 248px;

  &__section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__label {
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__grid {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }

  :deep(.t-button.is-active) {
    color: var(--td-brand-color);
    background: var(--td-brand-color-light);
  }
}
</style>
