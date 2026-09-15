<template>
  <div ref="rootRef" class="doc-toolbar">
    <article-version-panel
      :versions="versions"
      :active-version-id="activeVersionId"
      :humanizing="humanizing"
      :streaming-version-id="streamingVersionId"
      @select="(id) => emit('select-version', id)"
      @remove="(id) => emit('remove-version', id)"
    />
    <div class="doc-toolbar__sep" />
    <!-- 格式区：按可用宽度决定内联哪些，「更多」面板收纳装不下的 -->
    <article-format-buttons
      :state="state"
      :disabled="humanizing"
      :inline-block-type="layout.inlineBlockType"
      :inline-buttons="inlineButtons"
      :overflow-cmds="overflowCmds"
      :show-images-in-panel="!layout.imagesInline"
      :has-selection="hasSelection"
      :gen-image-tip="genImageTooltip"
      @command="(cmd) => emit('command', cmd)"
      @block-type="(type) => emit('block-type', type)"
      @upload-image="uploadImage"
      @gen-image="emit('gen-image')"
    />
    <div class="doc-toolbar__spacer" />
    <!-- 插图 / 生图：宽度不足时收进「更多」面板 -->
    <div v-if="layout.imagesInline" class="doc-toolbar__images">
      <t-tooltip content="插图（上传本地图片）">
        <t-button
          size="small"
          variant="text"
          shape="square"
          :disabled="humanizing"
          @click="uploadImage"
        >
          <template #icon><image-add-icon /></template>
        </t-button>
      </t-tooltip>
      <t-tooltip :content="genImageTooltip">
        <t-button
          size="small"
          variant="text"
          shape="square"
          :disabled="humanizing || !canGenerate || !hasSelection"
          @click="emit('gen-image')"
        >
          <template #icon><ai-image-icon /></template>
        </t-button>
      </t-tooltip>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { AiImageIcon, ImageAddIcon } from 'tdesign-icons-vue-next'
import { useAuthStore } from '@/windows/main/store/AuthStore'
import type { ArticleVersion } from '@/windows/main/modules/tool/components/article/articleTypes'
import {
  copyImageToAssets,
  resolveAssetRel
} from '@/windows/main/modules/tool/components/article/imageRef'
import { MessageUtil } from '@/utils/modal'
import ArticleVersionPanel from './ArticleVersionPanel.vue'
import ArticleFormatButtons from './ArticleFormatButtons.vue'
import type {
  ArticleBlockType,
  ArticleEditorCommand,
  ArticleEditorState
} from './articleEditorCommands'
import {
  ARTICLE_FORMAT_BUTTONS,
  BLOCK_TYPE_WIDTH,
  FORMAT_BUTTON_WIDTH,
  FORMAT_GAP,
  FORMAT_SEP_WIDTH,
  IMAGE_BUTTON_WIDTH,
  MORE_BUTTON_WIDTH,
  SECTION_GAP,
  FLEX_GAP_TOTAL,
  VERSION_MIN_WIDTH
} from './articleFormatButtons'

const props = defineProps<{
  versions: ArticleVersion[]
  activeVersionId: string
  humanizing?: boolean
  streamingVersionId?: string | null
  /** 配图目录（插图上传落盘于此） */
  assetsDir: string
  /** 当前文章 md 所在目录（相对引用计算基准） */
  baseDir: string
  /** 编辑器是否有选中文字（生图以选中内容为依据，未选中则禁用） */
  hasSelection?: boolean
  /** 编辑器状态快照（格式 active 态 / 块类型 / 撤销可用性） */
  state: ArticleEditorState
}>()

const emit = defineEmits<{
  /** 单条格式命令（加粗 / 撤销 / 表格等） */
  (e: 'command', cmd: ArticleEditorCommand): void
  /** 块类型（下拉开标题等级等） */
  (e: 'block-type', type: ArticleBlockType): void
  /** 插入图片（rel 为相对 md 目录的引用路径，插入光标处） */
  (e: 'insert', rel: string): void
  (e: 'gen-image'): void
  (e: 'select-version', versionId: string): void
  (e: 'remove-version', versionId: string): void
}>()

/** 生图门控：登录即可用（直出接口，积分由服务端扣减） */
const canGenerate = computed(() => useAuthStore().status === 'signed-in')

/**
 * 生图提示：未选中时提示先选文字（按钮禁用），选中后说明「据选中文字生图」。
 * 生图以选中内容为唯一依据——没有选中就无从确定画什么、插到哪，故不给兜底。
 */
const genImageTooltip = computed(() => {
  if (!canGenerate.value) return '登录后可使用生图'
  if (props.humanizing) return '正在改写中，暂不可生图'
  if (!props.hasSelection) return '请先选中要配图的文字'
  return '根据选中文字生图'
})

// ─── 宽度自适应：工具栏恒为一行，装不下的收进「更多」 ─────────────────

const rootRef = ref<HTMLElement | null>(null)
/** 工具栏内容区可用宽度（ResizeObserver 的 contentRect 实测，已排除 padding；0 = 尚未测量） */
const availableWidth = ref(0)

/** 内联布局计算结果 */
interface ToolbarLayout {
  inlineBlockType: boolean
  inlineCount: number
  imagesInline: boolean
}

/** 两种极端（供未测量时兜底与回收分支复用）：最保守 / 全内联 */
const FALLBACK_LAYOUT: ToolbarLayout = {
  inlineBlockType: false,
  inlineCount: 2,
  imagesInline: false
}
const FULL_LAYOUT: ToolbarLayout = {
  inlineBlockType: true,
  inlineCount: ARTICLE_FORMAT_BUTTONS.length,
  imagesInline: true
}

const allButtonsWidth =
  ARTICLE_FORMAT_BUTTONS.length * FORMAT_BUTTON_WIDTH +
  (ARTICLE_FORMAT_BUTTONS.length - 1) * FORMAT_GAP
const imagesCost = IMAGE_BUTTON_WIDTH * 2 + FORMAT_GAP + SECTION_GAP
/** 块类型下拉的完整占位（含其后的分隔线，覆盖「还有按钮跟在后面」的常见情形） */
const blockTypeCost = BLOCK_TYPE_WIDTH + FORMAT_SEP_WIDTH

/**
 * 计算内联布局（工具栏恒为一行，装不下的收进「更多」）。
 *
 * 关键点：
 * - `total` 是 contentRect 宽度（已排除 padding），故**不再**扣 TOOLBAR_PADDING。
 * - 版本按钮可收缩至 VERSION_MIN_WIDTH，预算按该最小值扣除；实际更宽时由 flex 收缩补足差额。
 * - **块类型下拉之后的那个分隔线只在有按钮跟随时才渲染**，故 0 按钮时按 BLOCK_TYPE_WIDTH
 *   计费、≥1 按钮时才补计分隔线 —— 否则会在 232px 默认宽度下误判成「放不下」。
 * - 无循环依赖：全程只用常量，与「谁被收进面板」无关。
 * - 若**全部内容**都装得下，则不预留「更多」按钮宽度（此时它根本不显示）。
 */
const layout = computed<ToolbarLayout>(() => {
  const total = availableWidth.value
  if (total <= 0) return FALLBACK_LAYOUT

  const base = total - VERSION_MIN_WIDTH - FORMAT_SEP_WIDTH - FLEX_GAP_TOTAL

  // 先试算「不需要更多按钮」的情形：块类型 + 全部格式按钮 + 插图都内联
  if (base - blockTypeCost - imagesCost >= allButtonsWidth) {
    return FULL_LAYOUT
  }

  // 需要「更多」按钮时，先为它预留宽度
  let budget = base - MORE_BUTTON_WIDTH

  // ① 块类型下拉：只要放得下就先保住它（它承载「光标当前块形态」，无悬浮框替代品；
  //    而加粗/斜体等在选中文字的气泡菜单里也有，故窄栏时优先牺牲格式按钮）
  const inlineBlockType = budget >= BLOCK_TYPE_WIDTH
  if (inlineBlockType) budget -= BLOCK_TYPE_WIDTH

  // ② 格式按钮用统一的「从前往后尽量放」计算；极端窄栏（<200px）下若保块类型就一个按钮
  //    都放不下，那不如让块类型进面板、把位置留给按钮——否则工具栏空得只剩一个下拉
  const fitButtons = (avail: number): number => {
    let used = 0
    let count = 0
    for (let i = 0; i < ARTICLE_FORMAT_BUTTONS.length; i++) {
      const need = FORMAT_BUTTON_WIDTH + (count > 0 ? FORMAT_GAP : 0)
      if (used + need > avail) break
      used += need
      count++
    }
    return count
  }

  // ③ 插图 / 生图：仅在自留 3 个按钮余量时才内联
  const imagesInline = budget - imagesCost >= FORMAT_BUTTON_WIDTH * 3 + FORMAT_GAP * 2
  if (imagesInline) budget -= imagesCost

  let blockTypeFinal = inlineBlockType
  let buttonCount = fitButtons(budget - (inlineBlockType ? FORMAT_SEP_WIDTH : 0))
  if (blockTypeFinal && buttonCount === 0) {
    // 保下拉则一个按钮都没有 → 让位给按钮
    const withoutBlock = budget + BLOCK_TYPE_WIDTH
    const alt = fitButtons(withoutBlock)
    if (alt > 0) {
      blockTypeFinal = false
      buttonCount = alt
    }
  }
  return { inlineBlockType: blockTypeFinal, inlineCount: buttonCount, imagesInline }
})

const inlineButtons = computed(() => ARTICLE_FORMAT_BUTTONS.slice(0, layout.value.inlineCount))
const overflowCmds = computed(() =>
  ARTICLE_FORMAT_BUTTONS.slice(layout.value.inlineCount).map((b) => b.cmd)
)

let observer: ResizeObserver | undefined

onMounted(() => {
  const el = rootRef.value
  if (!el) return
  observer = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width ?? 0
    if (width > 0) availableWidth.value = width
  })
  observer.observe(el)
  availableWidth.value = el.clientWidth
})

onBeforeUnmount(() => observer?.disconnect())

// ─── 插图上传 ────────────────────────────────────────────────────────

/** 系统选图 → 拷入 assets → 插入光标处 */
const uploadImage = async (): Promise<void> => {
  const selected = await window.preload.inject.dialog.open({
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
  })
  const src = selected?.[0]
  if (!src) return
  try {
    const absPath = await copyImageToAssets(props.assetsDir, src, 'image')
    emit('insert', resolveAssetRel(props.baseDir, absPath))
  } catch {
    MessageUtil.error('图片复制失败')
  }
}
</script>
<style scoped lang="less">
.doc-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--td-border-level-1-color);
  background: var(--td-bg-color-container);
  /* 恒为一行：溢出由 JS 收进「更多」面板 */
  flex-wrap: nowrap;
  min-width: 0;

  &__sep {
    width: 1px;
    height: 16px;
    margin: 0 4px;
    flex-shrink: 0;
    background: var(--td-border-level-1-color);
  }

  &__spacer {
    flex: 1;
    min-width: 0;
  }

  &__images {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }
}
</style>
