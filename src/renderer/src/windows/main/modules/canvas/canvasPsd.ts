import { Group, Rect, type Leafer } from 'leafer-editor'
import { writePsd } from 'ag-psd'
import type { BlendMode, Layer, Psd } from 'ag-psd'
import type { CanvasDoc, CanvasNode } from './canvasTypes'
import {
  computeLayoutBounds,
  layoutCanvasDoc,
  type CanvasLayoutNode,
  type CanvasNodeBounds
} from './canvasLayout'
import { compact, resolvePaint } from './canvasPaint'
import { ensureFontsForDoc } from './fontRegistry'
import { buildNodeWithExtras, settleAnimations } from './canvasRender'
import { createOffscreenLeafer } from './offscreenCanvas'
import { prepareMosaicOverlays } from './mosaicOverlay'

/**
 * 画布导出分层 PSD（MVP：逐图层位图化）：
 * - 叶子节点 → 独立离屏光栅化为透明位图，填入 PSD 图层（保留名称 / 不透明度 / 混合模式 / 显隐）
 * - group → PSD 图层组（自身填充 / 描边补一层背景位图）；带 effects 的 group 拍平为单图层保视觉
 * - 画布底色 → 最底层不透明背景图层
 * 已知限制：文本 / 矢量 / 效果均烘焙进位图（PS 内不可再编辑）；旋转烘焙进位图；
 * group 裁剪不映射；canvas 与 PSD 混合模式非一一对应，无对应项降级 normal。
 */

/** PSD 图层可用的混合模式全集（leafer 值去「-」即命中；额外收 linear dodge） */
const PSD_BLEND_MODES: ReadonlySet<string> = new Set([
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color dodge',
  'color burn',
  'hard light',
  'soft light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
  'linear dodge'
])

/** leafer（canvas 值）→ PSD 混合模式；无对应项降级 normal（group 缺省 pass through） */
const toPsdBlendMode = (mode: string | undefined, isGroup: boolean): BlendMode => {
  if (!mode || mode === 'normal' || mode === 'source-over') {
    return isGroup ? 'pass through' : 'normal'
  }
  if (mode === 'lighter') return 'linear dodge'
  const mapped = mode.replace(/-/g, ' ')
  return PSD_BLEND_MODES.has(mapped) ? (mapped as BlendMode) : 'normal'
}

/** 导出 Blob → 画布（ag-psd 图层像素只吃 HTMLCanvasElement / ImageData） */
const blobToCanvas = async (
  blob: Blob,
  width: number,
  height: number
): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const bitmap = await createImageBitmap(blob)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
  }
  return canvas
}

/** 截图导出参数（整数坐标，宽高至少 1） */
const screenshotOf = (abs: { x: number; y: number; width: number; height: number }) => ({
  x: Math.round(abs.x),
  y: Math.round(abs.y),
  width: Math.max(1, Math.round(abs.width)),
  height: Math.max(1, Math.round(abs.height))
})

/** leafer 导出结果 → Blob（数据非 Blob 视为导出失败） */
const exportBlob = async (leafer: Leafer, abs: CanvasNodeBounds): Promise<Blob> => {
  const result = await leafer.export('png', { blob: true, screenshot: screenshotOf(abs) })
  if (!(result.data instanceof Blob)) throw new Error('PSD 图层数据导出失败')
  return result.data
}

export const exportCanvasPsd = async (doc: CanvasDoc): Promise<ArrayBuffer> => {
  // 先确保画布用到的字体已加载（与 PNG 导出同一事实源，保证文字光栅化不缺字），
  // 并预热图片遮盖叠加位图（马赛克 / 毛玻璃）
  await Promise.all([ensureFontsForDoc(doc), prepareMosaicOverlays(doc)])
  const palette = doc.palette ?? {}
  const boundsById = new Map(computeLayoutBounds(doc).map((b) => [b.id, b]))
  const { leafer, dispose } = createOffscreenLeafer(doc.width, doc.height)
  try {
    /** 单节点子树光栅化为透明位图（共享离屏实例，clear 串行复用防内存峰值） */
    const rasterize = async (
      layout: CanvasLayoutNode,
      abs: CanvasNodeBounds
    ): Promise<HTMLCanvasElement> => {
      leafer.clear()
      // 元素坐标是「相对父盒」：单独挂载时用包装组平移回画布绝对位置（不改变子树相对结构与旋转）。
      // 图片遮盖叠加层（马赛克 / 毛玻璃）随宿主节点一起光栅化，保证 PSD 与 PNG / 画布视觉一致
      const wrapper = new Group({ x: abs.x - layout.x, y: abs.y - layout.y })
      for (const element of buildNodeWithExtras(layout, palette)) wrapper.add(element)
      leafer.add(wrapper)
      settleAnimations([wrapper])
      return blobToCanvas(await exportBlob(leafer, abs), abs.width, abs.height)
    }

    /** 画布底色 → 最底层不透明背景图层（保证无内容区域不透明） */
    const buildBackgroundLayer = async (): Promise<Layer> => {
      const abs: CanvasNodeBounds = {
        id: '',
        type: 'rect',
        x: 0,
        y: 0,
        width: doc.width,
        height: doc.height,
        centerX: doc.width / 2,
        centerY: doc.height / 2,
        depth: 0
      }
      leafer.clear()
      leafer.add(
        new Rect({ x: 0, y: 0, width: doc.width, height: doc.height, fill: doc.background || '#ffffff' })
      )
      return {
        name: '背景',
        canvas: await blobToCanvas(await exportBlob(leafer, abs), doc.width, doc.height),
        left: 0,
        top: 0,
        blendMode: 'normal'
      }
    }

    /** group 自身填充 / 描边 → 图层组内第一层背景位图（递归子层不含组背景，需单独补） */
    const buildGroupBackgroundLayer = async (
      node: CanvasNode,
      abs: CanvasNodeBounds
    ): Promise<Layer | null> => {
      const fill = resolvePaint(node.fill, palette)
      const stroke = resolvePaint(node.stroke, palette)
      if (!fill && !stroke) return null
      leafer.clear()
      leafer.add(
        new Rect(
          compact({
            x: abs.x,
            y: abs.y,
            width: Math.max(1, abs.width),
            height: Math.max(1, abs.height),
            cornerRadius: node.cornerRadius,
            fill,
            stroke,
            strokeWidth: node.strokeWidth,
            strokeAlign: node.strokeAlign,
            dashPattern: node.dashPattern
          })
        )
      )
      return {
        name: `${node.name || '组'} 背景`,
        canvas: await blobToCanvas(await exportBlob(leafer, abs), abs.width, abs.height),
        left: Math.round(abs.x),
        top: Math.round(abs.y),
        blendMode: 'normal'
      }
    }

    /** 布局树 → PSD 图层树（递归；坐标一律画布绝对，供 ag-psd 定位图层） */
    const buildLayer = async (layout: CanvasLayoutNode): Promise<Layer> => {
      const { node } = layout
      const abs = boundsById.get(node.id)
      if (!abs) throw new Error(`未找到节点 ${node.id} 的布局信息`)
      const common = {
        name: node.name || node.type,
        opacity: node.opacity,
        hidden: node.visible === false || undefined,
        blendMode: toPsdBlendMode(node.blendMode, node.type === 'group')
      }
      // group：无效果时映射为 PSD 图层组（组结构在 PS 内可编辑），有效果时整组拍平保视觉
      if (node.type === 'group' && !node.effects?.length && layout.children.length > 0) {
        const children: Layer[] = []
        const bg = await buildGroupBackgroundLayer(node, abs)
        if (bg) children.push(bg)
        for (const child of layout.children) children.push(await buildLayer(child))
        return { ...common, children, opened: true }
      }
      return {
        ...common,
        left: Math.round(abs.x),
        top: Math.round(abs.y),
        canvas: await rasterize(layout, abs)
      }
    }

    const children: Layer[] = [await buildBackgroundLayer()]
    for (const root of layoutCanvasDoc(doc)) children.push(await buildLayer(root))
    const psd: Psd = { width: doc.width, height: doc.height, children }
    return writePsd(psd, { generateThumbnail: false })
  } finally {
    dispose()
  }
}
