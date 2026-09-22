/**
 * 画布元素变换写回：编辑器拖拽 / 缩放 / 旋转结束（isEnd）时，
 * 把 leafer 元素的新变换写回画布 model 并保存（与 AI 编辑同链路触发重渲染/落盘）。
 */
import type { App } from 'leafer-editor'
import type { CanvasDoc, CanvasStore } from '@/windows/main/modules/canvas'
import { findCanvasNode } from '@/windows/main/modules/canvas'

/** 被编辑元素的最小结构（拖拽结束后读回变换） */
interface EditorElement {
  id?: string
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
}

interface UseCanvasTransformOptions {
  getApp: () => App | null
  store: () => CanvasStore | null
}

/** 拖拽 / 缩放 / 旋转结束（isEnd）→ 把元素新变换写回画布 model 并保存 */
export const useCanvasTransform = (options: UseCanvasTransformOptions) => {
  const syncEditorTransform = async () => {
    const doc: CanvasDoc | null = options.store()?.current.value ?? null
    const items = options.getApp()?.editor?.list
    if (!doc || !items?.length) return
    let changed = false
    for (const raw of items) {
      const el = raw as EditorElement
      if (!el.id) continue
      const node = findCanvasNode(doc.nodes, el.id)
      if (!node) continue
      if (typeof el.x === 'number' && Math.abs(el.x - (node.x ?? 0)) > 0.5) {
        node.x = Math.round(el.x)
        changed = true
      }
      if (typeof el.y === 'number' && Math.abs(el.y - (node.y ?? 0)) > 0.5) {
        node.y = Math.round(el.y)
        changed = true
      }
      if (typeof el.rotation === 'number' && Math.abs(el.rotation - (node.rotation ?? 0)) > 0.5) {
        node.rotation = Math.round(el.rotation)
        changed = true
      }
      // 尺寸：仅自由节点写回；布局组（layout 非 none）尺寸由引擎排布
      const isFreeGroup = node.type !== 'group' || node.layout == null || node.layout === 'none'
      const nodeW = typeof node.width === 'number' ? node.width : 0
      const nodeH = typeof node.height === 'number' ? node.height : 0
      if (isFreeGroup && typeof el.width === 'number' && Math.abs(el.width - nodeW) > 0.5) {
        node.width = Math.round(el.width)
        changed = true
      }
      if (isFreeGroup && typeof el.height === 'number' && Math.abs(el.height - nodeH) > 0.5) {
        node.height = Math.round(el.height)
        changed = true
      }
    }
    const store = options.store()
    if (changed && store) await store.save()
  }

  const handleTransformEnd = (event: { isEnd?: boolean }) => {
    if (!event.isEnd) return
    void syncEditorTransform()
  }

  return { handleTransformEnd }
}
