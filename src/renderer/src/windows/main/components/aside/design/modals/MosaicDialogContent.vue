<template>
  <mosaic-editor
    :source="source"
    :initial="initial"
    :apply="applyCanvasMosaic"
    apply-label="应用"
    restore-label="复原（清除记录）"
    cancel-label="取消"
    @close="emit('close')"
    @done="emit('success')"
  />
</template>
<script lang="ts" setup>
import { MessageUtil } from '@/utils/modal'
import { applyNodeMosaic, clearNodeMosaic } from '@/windows/main/modules/canvas'
import type { CanvasMosaic } from '@/windows/main/modules/canvas'
import MosaicEditor from '@/windows/main/components/mosaic/MosaicEditor.vue'
import type { MosaicApplyPayload } from '@/windows/main/components/mosaic/useMosaicEditor'

const props = defineProps<{
  /** 源图本地绝对路径（画布 image 节点的 imageUrl） */
  source: string
  sandbox: string
  /** 遮盖记录写回的目标画布 image 节点 id */
  nodeId: string
  /** 节点已记录的遮盖（打开即回填，支持局部增删 / 复原） */
  initial?: CanvasMosaic
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
}>()

/**
 * 应用出口（画布内）：写节点遮盖记录（非破坏，原图不变）；标记清空后应用 = 复原（删字段）。
 * 全程零 IPC、零文件产出。
 */
const applyCanvasMosaic = async (payload: MosaicApplyPayload) => {
  const sandboxDir = props.sandbox
  try {
    if (!payload.regions.length) {
      await clearNodeMosaic({ sandboxDir, nodeId: props.nodeId })
      MessageUtil.success('已复原：移除遮盖记录')
      return { hasRecord: false }
    }
    await applyNodeMosaic({
      sandboxDir,
      nodeId: props.nodeId,
      regions: payload.regions,
      style: payload.style,
      cellPx: payload.cellPx,
      blurPx: payload.blurPx
    })
    MessageUtil.success('已应用遮盖（可随时复原）')
    return { hasRecord: true }
  } catch (e) {
    MessageUtil.error('遮盖应用失败', e)
    throw e
  }
}
</script>
