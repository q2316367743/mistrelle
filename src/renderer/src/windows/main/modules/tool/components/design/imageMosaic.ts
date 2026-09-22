/**
 * image_mosaic 工具：遮盖图片的指定区域（马赛克 / 毛玻璃），两种落点：
 * - 画布内图片（node 指定，或缺省自动匹配 imageUrl 等于源图的 image 节点）：**非破坏记录** ——
 *   区域与参数写入该节点 `mosaic` 字段，原图不变、画布实时叠加遮盖，可随时复原（regions 传空 = 复原）。
 * - 画布外独立文件：烘焙落盘为新 PNG（原图不变），返回新图路径。
 * 与 ocr_image 配套：识别结果的包围盒可直接作为 regions 传入。
 */
import type { ToolFunction } from '@/domain'
import { registerToolPolicy, type ToolPolicyContext } from '@/windows/main/modules/tool/toolPolicy'
import { isPathUnder } from '@/utils/sandbox'
import {
  applyNodeMosaic,
  findCanvasNode,
  findImageNodeByUrl,
  getCanvasStore,
  mosaicCanvasImage,
  rectMosaicRegion,
  resolveCover
} from '@/windows/main/modules/canvas'
import type { CanvasNode } from '@/windows/main/modules/canvas'
import type { ImageCoverStyle } from '@common/types/mosaic'
import type { DesignToolContext } from './websiteLogo'

interface MosaicRegion {
  x: number
  y: number
  w: number
  h: number
}

/** 解析画布中的目标 image 节点：显式 node 优先（未找到 / 非图片即报错），否则按 imageUrl 匹配 */
const resolveCanvasImageNode = (
  sandboxDir: string,
  source: string,
  nodeId?: string
): CanvasNode | null => {
  const doc = getCanvasStore(sandboxDir).current.value
  if (!doc) return null
  if (!nodeId) return findImageNodeByUrl(doc.nodes, source)
  const node = findCanvasNode(doc.nodes, nodeId)
  if (!node) throw new Error(`画布节点未找到：${nodeId}`)
  if (node.type !== 'image') throw new Error(`节点不是图片类型，无法遮盖：${nodeId}`)
  return node
}

export const createImageMosaicTool = (ctx: DesignToolContext): ToolFunction => ({
  name: 'image_mosaic',
  label: '图片遮盖（马赛克 / 毛玻璃）',
  description:
    '遮盖图片中的指定区域：style 选 mosaic 马赛克（像素块）或 blur 毛玻璃（高斯模糊），' +
    'strength 调强度（马赛克=块边长 px 越小越细腻，毛玻璃=模糊半径 px）。regions 每项 ' +
    '{x, y, w, h} 是相对原图左上角的像素坐标——可直接使用 ocr_image 返回的文字包围盒，' +
    '实现给敏感文字自动遮盖。画布内的图片走非破坏记录（区域记在 image 节点的 mosaic 字段，' +
    '原图不变、可随时复原；regions 传空数组 = 复原）；画布外的独立文件则烘焙保存为新 PNG 并返回新图路径。' +
    'node 传入画布 image 节点 id 时作用于该节点，缺省时自动匹配画布中引用源图的 image 节点。',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '源图片文件绝对路径' },
      regions: {
        type: 'array',
        items: {
          type: 'object',
          description: '遮盖区域（相对原图左上角的像素坐标 + 宽高）',
          properties: {
            x: { type: 'number', description: '区域左上角 x' },
            y: { type: 'number', description: '区域左上角 y' },
            w: { type: 'number', description: '区域宽度' },
            h: { type: 'number', description: '区域高度' }
          },
          required: ['x', 'y', 'w', 'h']
        },
        description:
          '遮盖区域列表（与 ocr_image 的文字包围盒坐标系一致，可直通传入）；画布图片传空数组 = 复原'
      },
      style: {
        type: 'string',
        enum: ['mosaic', 'blur'],
        description: '遮盖方式：mosaic 马赛克（默认）/ blur 毛玻璃（高斯模糊）'
      },
      strength: {
        type: 'number',
        description: '遮盖强度：马赛克=像素块边长 px（默认 14，越小越细腻）/ 毛玻璃=模糊半径 px（默认 8）'
      },
      node: {
        type: 'string',
        description:
          '画布 image 节点 id：作用于该节点；缺省时自动匹配画布中引用源图的 image 节点'
      }
    },
    required: ['path', 'regions']
  },
  risk: 'sensitive',
  handler: async (...params: unknown[]) => {
    const {
      path: source,
      regions,
      node,
      style,
      strength
    } = params[0] as {
      path?: string
      regions?: MosaicRegion[]
      node?: string
      style?: ImageCoverStyle
      strength?: number
    }
    if (!source) return { error: '缺少 path：请输入源图片文件路径' }
    const list = Array.isArray(regions) ? regions : []
    const cover = resolveCover({ style, cellPx: strength, blurPx: strength })
    const sandboxDir = ctx.getSandboxDir()
    try {
      const target = resolveCanvasImageNode(sandboxDir, source, node)
      if (target) {
        const result = await applyNodeMosaic({
          sandboxDir,
          nodeId: target.id,
          regions: list.map((region) => rectMosaicRegion(region, 'text')),
          style: cover.style,
          cellPx: cover.cellPx,
          blurPx: cover.blurPx
        })
        return {
          success: true,
          mode: 'canvas',
          path: source,
          node: result.nodeId,
          style: result.style,
          applied: result.regions,
          note: result.regions
            ? `已在画布图片节点上记录 ${result.regions} 处遮盖（原图未改动，可随时复原）`
            : '已复原：该节点的遮盖记录已清除'
        }
      }
      if (!list.length) {
        return { error: 'regions 为空：该图片不在画布中，至少需要一个遮盖区域' }
      }
      const result = await mosaicCanvasImage({
        sandboxDir,
        source,
        regions: list,
        nodeId: node,
        style: cover.style,
        cellPx: cover.cellPx,
        blurPx: cover.blurPx
      })
      return {
        success: true,
        mode: 'file',
        path: result.output,
        width: result.width,
        height: result.height,
        applied: result.applied,
        ...(result.nodeId ? { node: result.nodeId } : {}),
        note: result.nodeId
          ? '已遮盖并更新画布 image 节点指向新图（原图保留）'
          : '已遮盖并保存为新图片；如需更新画布，请把该 path 填入对应 image 节点的 imageUrl'
      }
    } catch (e) {
      return { error: `遮盖处理失败：${e instanceof Error ? e.message : String(e)}` }
    }
  }
})

/**
 * image_mosaic 读写策略：源图需位于沙盒 / 工作空间 / 用户主目录（可信区）内自动放行，
 * 其余路径需用户审批（与 image_crop 的读图策略一致）。烘焙产物固定写沙盒 outputs/。
 */
registerToolPolicy({
  name: 'image_mosaic',
  resolve(_tool, args, ctx: ToolPolicyContext) {
    const userDirs = [ctx.sandboxDir, ctx.workspace, window.preload.inject.os.getPath('home')].filter(
      Boolean
    )
    const inTrusted = (v: unknown): boolean =>
      typeof v === 'string' && !!v && userDirs.some((dir) => isPathUnder(v, dir))
    return inTrusted(args.path) ? 'allow' : 'ask'
  }
})
