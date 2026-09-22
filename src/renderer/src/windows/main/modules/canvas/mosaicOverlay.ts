/**
 * 图片遮盖叠加层（马赛克 / 毛玻璃）：节点 `mosaic` 字段 → 透明叠加位图 → Leafer Image 元素。
 *
 * 非破坏渲染：图片元素始终指向原图，叠加层只覆盖被记录的区域；改 / 删节点 `mosaic` 字段
 * 即改变遮盖效果（删除即无损复原），全程不产生新图片文件。
 *
 * 对齐策略：叠加元素几何（x/y/宽高/旋转/不透明度/显隐/动画）与图片元素完全一致，
 * 且叠加位图与图片同宽高比 → 无论 Leafer 把图片按何种方式缩放进元素框，两层映射都相同，天然对齐。
 * 交互隔离：叠加元素无 id、`hittable:false`、不可编辑 → 点选 / 双击注入 / 编辑器行为与无遮盖时完全一致。
 * 效果隔离（有意）：不复制 `effects`（避免阴影二次叠加）与 `blendMode`（避免与已合成底图二次混合）。
 *
 * 位图生成是异步的（解码原图 + 画布编码），渲染 / 导出前由 `prepareMosaicOverlays` 预热，
 * 之后构建元素走同步缓存查询（`getMosaicOverlayHref`）。
 */
import { Image as LeaferImage } from 'leafer-editor'
import type { CanvasDoc, CanvasNode } from './canvasTypes'
import type { CanvasLayoutNode } from './canvasLayout'
import { compact } from './canvasPaint'
import { createGrid, resolveCover } from './mosaicGrid'
import { drawCoverInto } from './mosaicDraw'
import { loadImageElement } from './canvasImage'

/** 叠加位图长边上限（px）：跟随画布缩放已足够清晰，同时把大图的画布内存与编码耗时压下来 */
const OVERLAY_MAX_PX = 1600

/** 叠加位图缓存条数上限（每个节点一条，超出淘汰最早项并释放 blob URL） */
const OVERLAY_CACHE_LIMIT = 8

/** 原图解码缓存条数上限（同一图片被多节点引用时不重复解码） */
const DECODE_CACHE_LIMIT = 8

/** 叠加位图缓存：缓存键 → blob URL（Map 保持插入序，用于淘汰） */
const overlayCache = new Map<string, string>()

/** 原图解码缓存：图片引用 → 解码结果（失败也缓存，避免反复重试同一坏文件） */
const decodeCache = new Map<string, Promise<HTMLImageElement | null>>()

/** 缓存键：图片 + 遮盖参数 + 区域（同一份数据必然命中同一张叠加位图） */
const overlayKey = (node: CanvasNode): string | null => {
  const mosaic = node.mosaic
  if (!node.imageUrl || !mosaic?.regions?.length) return null
  const cover = resolveCover(mosaic)
  return `${node.imageUrl}|${cover.style}|${cover.cellPx}|${cover.blurPx}|${JSON.stringify(
    mosaic.regions
  )}`
}

const loadImage = (value: string | undefined): Promise<HTMLImageElement | null> => {
  const key = value ?? ''
  const cached = decodeCache.get(key)
  if (cached) return cached
  const task = loadImageElement(value)
  decodeCache.set(key, task)
  if (decodeCache.size > DECODE_CACHE_LIMIT) {
    const oldest = decodeCache.keys().next().value
    if (oldest != null && oldest !== key) decodeCache.delete(oldest)
  }
  return task
}

const putOverlay = (key: string, href: string): void => {
  overlayCache.set(key, href)
  while (overlayCache.size > OVERLAY_CACHE_LIMIT) {
    const oldest = overlayCache.keys().next().value
    if (oldest == null || oldest === key) return
    const stale = overlayCache.get(oldest)
    overlayCache.delete(oldest)
    if (stale) URL.revokeObjectURL(stale)
  }
}

/** 生成叠加位图并缓存：区域路径裁剪后按 style 绘制（马赛克像素化 / 毛玻璃高斯模糊） */
const renderOverlay = async (
  image: HTMLImageElement,
  cover: ReturnType<typeof resolveCover>,
  paths: number[][],
  key: string
): Promise<string | null> => {
  const naturalW = image.naturalWidth
  const naturalH = image.naturalHeight
  if (!naturalW || !naturalH) return null
  const scale = Math.min(1, OVERLAY_MAX_PX / Math.max(naturalW, naturalH))
  const width = Math.max(1, Math.round(naturalW * scale))
  const height = Math.max(1, Math.round(naturalH * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  drawCoverInto(ctx, {
    image,
    paths,
    cover,
    grid: createGrid(naturalW, naturalH, cover.cellPx),
    width,
    height
  })
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((value) => resolve(value), 'image/png')
  )
  if (!blob) return null
  const href = URL.createObjectURL(blob)
  putOverlay(key, href)
  return href
}

const ensureOverlay = async (node: CanvasNode): Promise<string | null> => {
  const key = overlayKey(node)
  if (!key) return null
  const cached = overlayCache.get(key)
  if (cached) return cached
  const image = await loadImage(node.imageUrl)
  if (!image) return null
  const mosaic = node.mosaic
  if (!mosaic?.regions?.length) return null
  return renderOverlay(
    image,
    resolveCover(mosaic),
    mosaic.regions.map((region) => region.points),
    key
  )
}

/**
 * 同步查询叠加位图（渲染用）：仅当 `prepareMosaicOverlays` 已预热时命中，
 * 未命中返回 null（本次渲染无遮盖叠加，下一帧预热完成后由画布重渲染补上）。
 */
export const getMosaicOverlayHref = (node: CanvasNode): string | null => {
  const key = overlayKey(node)
  return key ? (overlayCache.get(key) ?? null) : null
}

/** 预热整张画布的遮盖叠加位图（渲染 / 导出前 await；串行执行以压住大图的内存峰值） */
export const prepareMosaicOverlays = async (doc: CanvasDoc): Promise<void> => {
  const walk = async (nodes: CanvasNode[]): Promise<void> => {
    for (const node of nodes) {
      if (node.type === 'image' && node.mosaic?.regions?.length) {
        try {
          await ensureOverlay(node)
        } catch {
          // 单张遮盖位图失败不影响整张画布渲染（与「跳过损坏节点」同策略）
        }
      }
      if (node.children?.length) await walk(node.children)
    }
  }
  await walk(doc.nodes)
}

/**
 * 构建遮盖叠加元素：几何与图片元素逐字段对齐（见文件头「对齐策略」），
 * 无 id / 不可编辑 / 不参与命中测试，效果与混合模式有意不复制。
 */
export const buildMosaicOverlay = (layout: CanvasLayoutNode): LeaferImage | null => {
  const { node } = layout
  const href = getMosaicOverlayHref(node)
  if (!href) return null
  const width = Number.isFinite(layout.width) ? layout.width : 0
  const height = Number.isFinite(layout.height) ? layout.height : 0
  return new LeaferImage(
    compact({
      x: layout.x,
      y: layout.y,
      rotation: node.rotation,
      opacity: node.opacity,
      visible: node.visible,
      animation: node.animation,
      animationOut: node.animationOut,
      ...(width > 0 ? { width } : {}),
      ...(height > 0 ? { height } : {}),
      url: href,
      hittable: false
    })
  )
}
