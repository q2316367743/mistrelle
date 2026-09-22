<template>
  <div class="image-mosaic-fields">
    <div class="image-mosaic-fields__title">遮盖</div>
    <div class="image-mosaic-fields__row">
      <span class="image-mosaic-fields__text ellipsis">{{ summary }}</span>
      <t-button size="small" variant="outline" :disabled="!node.imageUrl" @click="handleEdit">
        编辑
      </t-button>
      <t-button
        v-if="hasCover"
        size="small"
        theme="danger"
        variant="text"
        :loading="clearing"
        @click="handleClear"
      >
        复原
      </t-button>
    </div>
    <div class="image-mosaic-fields__hint">
      遮盖记录在节点上（原图不变），可随时编辑或复原
    </div>
  </div>
</template>
<script lang="ts" setup>
import { computed, ref } from 'vue'
import { MessageUtil } from '@/utils/modal'
import {
  clearNodeMosaic,
  coverStyleLabel,
  resolveCover
} from '@/windows/main/modules/canvas'
import type { CanvasNode } from '@/windows/main/modules/canvas'
import { openMosaicDialog } from './modals/MosaicDialog'

const props = defineProps<{
  sandbox: string
  /** 当前选中的图片节点 */
  node: CanvasNode
}>()

const hasCover = computed(() => (props.node.mosaic?.regions?.length ?? 0) > 0)

/** 遮盖摘要：方式 · 强度 · 处数（未遮盖时给出引导文案） */
const summary = computed(() => {
  const mosaic = props.node.mosaic
  if (!mosaic?.regions?.length) return '未遮盖'
  const cover = resolveCover(mosaic)
  const strength = cover.style === 'blur' ? `模糊 ${cover.blurPx}px` : `块边长 ${cover.cellPx}px`
  return `${coverStyleLabel(cover.style)} · ${strength} · ${mosaic.regions.length} 处`
})

const clearing = ref(false)

/** 打开遮盖弹窗（节点已有记录时回填，可局部增删） */
const handleEdit = () => {
  if (!props.node.imageUrl) return
  openMosaicDialog({
    sandbox: props.sandbox,
    nodeId: props.node.id,
    source: props.node.imageUrl,
    initial: props.node.mosaic
  })
}

/** 复原：删除节点遮盖记录（画布立即回到未遮盖状态） */
const handleClear = async () => {
  if (clearing.value) return
  clearing.value = true
  try {
    await clearNodeMosaic({ sandboxDir: props.sandbox, nodeId: props.node.id })
    MessageUtil.success('已复原：移除遮盖记录')
  } catch (e) {
    MessageUtil.error('复原失败', e)
  } finally {
    clearing.value = false
  }
}
</script>
<style scoped lang="less">
.image-mosaic-fields {
  &__title {
    margin: 8px 0;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__text {
    flex: 1;
    min-width: 0;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-primary);
  }

  &__hint {
    margin-top: 4px;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
