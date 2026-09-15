<template>
  <bubble-menu
    :editor="editor"
    :should-show="shouldShow"
    :update-delay="120"
    class="img-menu"
    @mousedown.prevent
  >
    <div class="img-menu__inner">
      <img v-if="preview" class="img-menu__thumb" :src="preview" alt="图片预览" />
      <div class="img-menu__actions">
        <t-button size="small" variant="text" :disabled="locked || !current" @click="copyImage">
          <template #icon><CopyIcon /></template>
          复制图片
        </t-button>
        <t-button size="small" variant="text" :disabled="locked || !current" @click="replaceImage">
          <template #icon><SwapIcon /></template>
          换图
        </t-button>
        <t-tooltip :content="regenTip" placement="top">
          <t-button
            size="small"
            variant="text"
            :disabled="locked || !canGenerate || !current"
            @click="regenerate"
          >
            <template #icon><AiImageIcon /></template>
            AI 重新生成
          </t-button>
        </t-tooltip>
        <t-button
          size="small"
          variant="text"
          theme="danger"
          :disabled="locked || !current"
          @click="removeImage"
        >
          <template #icon><DeleteIcon /></template>
          删除
        </t-button>
      </div>
    </div>
  </bubble-menu>
</template>
<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import type { Editor } from '@tiptap/core'
import { AiImageIcon, CopyIcon, DeleteIcon, SwapIcon } from 'tdesign-icons-vue-next'
import { useAuthStore } from '@/windows/main/store/AuthStore'
import {
  copyImageToAssets,
  resolveArticleImage,
  resolveAssetRel
} from '@/windows/main/modules/tool/components/article/imageRef'
import { MessageUtil } from '@/utils/modal'
import {
  deleteImageAt,
  findSelectedImage,
  replaceImageAt,
  resolveArticleImagePath,
  type SelectedImage
} from './articleEditorImages'

const props = defineProps<{
  editor: Editor
  /** 流式改写等期间锁定操作 */
  disabled?: boolean
  /** md 所在目录 */
  baseDir: string
  /** 配图目录（换图 / 生图产物落盘于此） */
  assetsDir: string
}>()

const emit = defineEmits<{
  /** 图片被替换为新的 rel（父级更新插图列表） */
  (e: 'image-changed', rel: string): void
  /** 图片被删除（父级按需清理插图列表） */
  (e: 'image-removed', rel: string): void
  /** 请求 AI 重新生成：父级持有文章标题 / 摘要 / 提纲语境，负责开弹窗 */
  (e: 'regen', payload: { pos: number; blockText: string }): void
}>()

const locked = computed(() => props.disabled === true)
const canGenerate = computed(() => useAuthStore().status === 'signed-in')

/** 当前选中的图片节点信息（选区变化即重算） */
const current = ref<SelectedImage | null>(null)

const refreshCurrent = (): void => {
  current.value = findSelectedImage(props.editor)
}

/** 仅当选中图片时显示；有变更时刷新快照 */
const shouldShow = (): boolean => {
  refreshCurrent()
  return !locked.value && current.value !== null
}

// 图片被替换 / 删除 / 光标移开都要同步快照：editor.state 非响应式，须订阅编辑器事件
const onTransaction = (): void => refreshCurrent()
onMounted(() => {
  props.editor.on('selectionUpdate', onTransaction)
  props.editor.on('transaction', onTransaction)
})
onBeforeUnmount(() => {
  props.editor.off('selectionUpdate', onTransaction)
  props.editor.off('transaction', onTransaction)
})

const preview = computed(() =>
  current.value && props.baseDir ? resolveArticleImage(props.baseDir, current.value.rel) : ''
)

const regenTip = computed(() => {
  if (!canGenerate.value) return '登录后可使用生图'
  if (locked.value) return '正在改写中，暂不可生图'
  return '据图片所在段落重新生成一张'
})

/** 复制图片本体到系统剪贴板（与封面复制同一套：main 侧按路径读盘） */
const copyImage = async (): Promise<void> => {
  const img = current.value
  if (!img) return
  const abs = resolveArticleImagePath(props.baseDir, img.rel)
  if (!abs) {
    MessageUtil.error('该图片不是本地文件，无法复制')
    return
  }
  try {
    const ok = await window.preload.inject.clipboard.copyImageByPath(abs)
    if (ok) MessageUtil.success('图片已复制，可直接粘贴')
    else MessageUtil.error('复制失败：图片文件不存在或不是有效图片')
  } catch {
    MessageUtil.error('复制图片失败')
  }
}

/** 换图：选本地图片 → 拷入 assets → 就地替换当前图片节点的 src（保持位置） */
const replaceImage = async (): Promise<void> => {
  const img = current.value
  if (!img) return
  const selected = await window.preload.inject.dialog.open({
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
  })
  const src = selected?.[0]
  if (!src) return
  try {
    const absPath = await copyImageToAssets(props.assetsDir, src, 'image')
    const rel = resolveAssetRel(props.baseDir, absPath)
    replaceImageAt(props.editor, img.pos, rel)
    emit('image-changed', rel)
    MessageUtil.success('已替换图片')
  } catch {
    MessageUtil.error('图片替换失败')
  }
}

/** 删除图片：删节点，并把原 rel 上报（父级确认无其它引用后再清理插图列表） */
const removeImage = (): void => {
  const img = current.value
  if (!img) return
  deleteImageAt(props.editor, img.pos)
  emit('image-removed', img.rel)
}

/** AI 重新生成：把位置与所在段落文字上报，由父级开弹窗并在成功后回填 */
const regenerate = (): void => {
  const img = current.value
  if (!img) return
  emit('regen', { pos: img.pos, blockText: img.blockText })
}
</script>
<style scoped lang="less">
.img-menu {
  padding: 6px;
  border-radius: var(--td-radius-medium);
  border: 1px solid var(--td-border-level-1-color);
  background: var(--td-bg-color-container);
  box-shadow: var(--td-shadow-2);

  &__inner {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__thumb {
    width: 44px;
    height: 44px;
    object-fit: cover;
    border-radius: var(--td-radius-small);
    border: 1px solid var(--td-border-level-1-color);
    flex-shrink: 0;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }
}
</style>
