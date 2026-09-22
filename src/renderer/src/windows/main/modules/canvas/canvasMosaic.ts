/**
 * 画布图片遮盖（马赛克 / 毛玻璃）写回链路：
 * - 画布内图片一律「非破坏记录」：区域与参数写入节点 `mosaic` 字段，`imageUrl` 始终指向原图，
 *   渲染层实时叠加遮盖（见 mosaicOverlay.ts），复原 = 删除该字段（原图从未被改写）。
 * - 画布外的独立文件才走烘焙落盘（main sharp 掩码替换到产物图），供 image_mosaic 工具使用。
 */
import { firstBatchError, getCanvasStore } from './CanvasStore'
import { pointsBounds, rectToPoints, resolveCover } from './mosaicGrid'
import type { MosaicRect } from './mosaicGrid'
import type { ImageCoverStyle } from '@common/types/mosaic'
import type {
  CanvasMosaic,
  CanvasMosaicRegion,
  CanvasMosaicRegionKind,
  CanvasNode
} from './canvasTypes'

/** 遮盖参数（两处遮盖方式共用：画布记录 / 文件烘焙） */
export interface MosaicCoverInput {
  style?: ImageCoverStyle
  /** 马赛克像素块边长（px，越小越细腻） */
  cellPx?: number
  /** 毛玻璃模糊半径（px） */
  blurPx?: number
}

/** 画布节点遮盖写回结果 */
export interface NodeMosaicResult {
  nodeId: string
  /** 写入的区域数（0 = 已复原） */
  regions: number
  style: ImageCoverStyle
}

export interface MosaicImageResult {
  /** 打码产物路径（原文件不变） */
  output: string
  width: number
  height: number
  applied: number
  /** 被更新指向新图的画布节点 id（未关联合并为 null） */
  nodeId: string | null
}

/** 在画布节点树中按 id 查找节点（含子树） */
export const findCanvasNode = (nodes: CanvasNode[], id: string): CanvasNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children?.length) {
      const found = findCanvasNode(node.children, id)
      if (found) return found
    }
  }
  return null
}

/** 矩形 → 遮盖区域（矩形 4 点） */
export const rectMosaicRegion = (
  rect: MosaicRect,
  kind: CanvasMosaicRegionKind = 'text',
  text?: string
): CanvasMosaicRegion => ({
  points: rectToPoints(rect),
  kind,
  ...(text ? { text } : {})
})

/** 区域归一化：坐标取整，过滤退化轮廓（少于 3 点 / 零面积） */
export const normalizeMosaicRegions = (regions: CanvasMosaicRegion[]): CanvasMosaicRegion[] => {
  const out: CanvasMosaicRegion[] = []
  for (const region of regions) {
    const points = region.points.map((value) => Math.round(value))
    if (points.length < 6) continue
    const bound = pointsBounds(points)
    if (bound.w < 1 || bound.h < 1) continue
    out.push({
      points,
      kind: region.kind === 'brush' ? 'brush' : 'text',
      ...(region.text ? { text: region.text } : {})
    })
  }
  return out
}

/** 取当前画布的 image 节点（非 image / 未找到均抛错，避免静默跳过让调用方以为已生效） */
const requireImageNode = (sandboxDir: string, nodeId: string): CanvasNode => {
  const doc = getCanvasStore(sandboxDir).current.value
  if (!doc) throw new Error('当前没有打开的画布')
  const node = findCanvasNode(doc.nodes, nodeId)
  if (!node) throw new Error(`画布节点未找到：${nodeId}`)
  if (node.type !== 'image') throw new Error(`节点不是图片类型，无法遮盖：${nodeId}`)
  return node
}

/**
 * 写入节点遮盖记录（非破坏）：区域与参数写进 `mosaic` 字段，原图不变。
 * 区域为空数组等同复原（内部转调 clearNodeMosaic）。
 */
export const applyNodeMosaic = async (
  options: {
    sandboxDir: string
    nodeId: string
    regions: CanvasMosaicRegion[]
  } & MosaicCoverInput
): Promise<NodeMosaicResult> => {
  const regions = normalizeMosaicRegions(options.regions)
  if (!regions.length) return clearNodeMosaic(options)
  const target = requireImageNode(options.sandboxDir, options.nodeId)
  const cover = resolveCover(options)
  const mosaic: CanvasMosaic = {
    style: cover.style,
    regions,
    // 只写当前方式对应的强度字段，保持记录干净
    ...(cover.style === 'mosaic' ? { cellPx: cover.cellPx } : { blurPx: cover.blurPx })
  }
  const store = getCanvasStore(options.sandboxDir)
  // batchEdit 单点容错不抛异常，须显式核对结果，否则失败也会被当成成功
  const { results } = await store.batchEdit([
    { op: 'update', path: target.id, patch: { mosaic } }
  ])
  const failure = firstBatchError(results)
  if (failure) throw new Error(`画布遮盖未更新：${failure}`)
  return { nodeId: target.id, regions: regions.length, style: cover.style }
}

/**
 * 复原：删除节点遮盖记录（画布立即回到未打码状态，原图从未被改写）。
 * 直接删字段而非 patch 置 undefined —— 与 `setPalette` 同为「改当前文档 + 落盘」，
 * 保证字段从 .canvas 中彻底消失（patch 只能把字段写成 undefined，语义靠序列化擦除）。
 */
export const clearNodeMosaic = async (options: {
  sandboxDir: string
  nodeId: string
}): Promise<NodeMosaicResult> => {
  const target = requireImageNode(options.sandboxDir, options.nodeId)
  const style = resolveCover(target.mosaic).style
  delete target.mosaic
  await getCanvasStore(options.sandboxDir).save()
  return { nodeId: target.id, regions: 0, style }
}

/**
 * 烘焙落盘（仅画布外的独立文件）：产物写 {sandboxDir}/outputs/images/{base}-mask-{时间戳}.png
 * （文件名必变，确保画布图像缓存失效），nodeId 指定或缺省自动匹配「imageUrl === source 的
 * image 节点」时，经 batchEdit 更新节点 imageUrl。
 */
export const mosaicCanvasImage = async (
  options: {
    sandboxDir: string
    source: string
    regions: MosaicRect[]
    /** 目标画布 image 节点 id；缺省时自动匹配引用源图的节点 */
    nodeId?: string
  } & MosaicCoverInput
): Promise<MosaicImageResult> => {
  const { sandboxDir, source, regions, nodeId } = options
  if (!regions.length) throw new Error('遮盖区域列表为空')
  const meta = await window.preload.inject.sharp.metadata(source)
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (!width || !height) throw new Error(`无法读取图片：${source}`)

  const outDir = window.preload.path.join(sandboxDir, 'outputs', 'images')
  await window.preload.fs.mkdir(outDir, true)
  const base = window.preload.path.basename(source, window.preload.path.extname(source))
  const output = window.preload.path.join(outDir, `${base}-mask-${Date.now()}.png`)

  // 归一化区域：取整、钳制到图片边界内、宽高至少为 1
  const normalized = regions.map((r) => {
    const left = Math.max(0, Math.min(Math.round(r.x), width - 1))
    const top = Math.max(0, Math.min(Math.round(r.y), height - 1))
    return {
      left,
      top,
      width: Math.max(1, Math.min(Math.round(r.w), width - left)),
      height: Math.max(1, Math.min(Math.round(r.h), height - top))
    }
  })
  const cover = resolveCover(options)
  const result = await window.preload.inject.sharp.mask(source, normalized, output, {
    style: cover.style,
    cellPx: cover.cellPx,
    blurPx: cover.blurPx
  })

  // 画布关联更新（batchEdit 单点容错不抛异常，须显式核对结果）
  let updatedNode: string | null = null
  const store = getCanvasStore(sandboxDir)
  const doc = store.current.value
  // 目标解析：显式 nodeId 优先，失效（画布切换 / 节点被删）时按「引用同一源图」兜底；
  // 显式给了 nodeId 却完全未命中必须报错——静默跳过会让调用方以为画布已更新
  const byId = doc && nodeId ? findCanvasNode(doc.nodes, nodeId) : null
  const target = byId?.type === 'image' ? byId : doc ? findImageNodeByUrl(doc.nodes, source) : null
  if (!target && nodeId) {
    throw new Error(`画布节点未找到（打码图已保存）：${nodeId}`)
  }
  if (target) {
    const { results } = await store.batchEdit([
      { op: 'update', path: target.id, patch: { imageUrl: output } }
    ])
    const failure = firstBatchError(results)
    if (failure) {
      throw new Error(`画布节点未更新（打码图已保存）：${failure}`)
    }
    updatedNode = target.id
  }
  return {
    output,
    width: result.width,
    height: result.height,
    applied: result.applied,
    nodeId: updatedNode
  }
}

/** 查找画布中 imageUrl 与源图一致的 image 节点（含子树） */
export const findImageNodeByUrl = (nodes: CanvasNode[], source: string): CanvasNode | null => {
  for (const node of nodes) {
    if (node.type === 'image' && node.imageUrl === source) return node
    if (node.children?.length) {
      const found = findImageNodeByUrl(node.children, source)
      if (found) return found
    }
  }
  return null
}
