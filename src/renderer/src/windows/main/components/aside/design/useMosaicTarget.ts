/**
 * 遮盖入口的目标解析：遮盖记录在 image 节点上，故目标 = 选中的图片节点；
 * 未选中时若画布只有一张图片则自动使用它，多图未选中则置灰并说明原因。
 */
import { computed } from 'vue'
import { getCanvasStore, findCanvasNode } from '@/windows/main/modules/canvas'
import type { CanvasMosaic, CanvasNode } from '@/windows/main/modules/canvas'

/** 遮盖目标：画布中的某个 image 节点 */
export interface MosaicTarget {
  nodeId: string
  /** 图片本地绝对路径（OCR 按路径读图，渲染层按路径解码） */
  source: string
  /** 该节点已记录的遮盖（打开弹窗即回填） */
  mosaic?: CanvasMosaic
}

/** 递归收集 image 节点（含子树，先序） */
const collectImageNodes = (nodes: CanvasNode[]): CanvasNode[] => {
  const images: CanvasNode[] = []
  for (const node of nodes) {
    if (node.type === 'image') images.push(node)
    if (node.children?.length) images.push(...collectImageNodes(node.children))
  }
  return images
}

/** 非本地来源（远程 / data URL / file 协议）OCR 与渲染层解码都读不到，不支持遮盖 */
const isLocalPath = (value: string): boolean =>
  !['http://', 'https://', 'data:', 'file://'].some((prefix) => value.startsWith(prefix))

const toTarget = (node: CanvasNode): MosaicTarget => ({
  nodeId: node.id,
  source: node.imageUrl ?? '',
  ...(node.mosaic ? { mosaic: node.mosaic } : {})
})

export const useMosaicTarget = (sandbox: () => string, selectedId: () => string | undefined) => {
  /** 校验图片可用并打包目标（非本地来源读不到像素） */
  const checked = (node: CanvasNode): { target: MosaicTarget | null; reason: string } => {
    if (!node.imageUrl || !isLocalPath(node.imageUrl)) {
      return { target: null, reason: '该图片不是本地文件，无法遮盖' }
    }
    return { target: toTarget(node), reason: '' }
  }

  /** target 非空即可用；否则 reason 说明禁用原因 */
  const resolved = computed<{ target: MosaicTarget | null; reason: string }>(() => {
    const doc = getCanvasStore(sandbox()).current.value
    if (!doc) return { target: null, reason: '暂无画布' }
    // 优先用选中的图片节点；未选中时退回「画布唯一图片」
    const id = selectedId()
    const selected = id ? findCanvasNode(doc.nodes, id) : null
    if (selected?.type === 'image') return checked(selected)
    const images = collectImageNodes(doc.nodes)
    if (!images.length) return { target: null, reason: '画布中没有图片' }
    if (images.length > 1) return { target: null, reason: '请先在画布中选择要遮盖的图片' }
    return checked(images[0])
  })

  return {
    target: computed(() => resolved.value.target),
    reason: computed(() => resolved.value.reason)
  }
}
