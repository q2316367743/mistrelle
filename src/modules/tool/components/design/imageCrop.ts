/**
 * image_crop 工具：将一张图片按区域 / 网格裁剪成多张 PNG。
 * - 使用 uTools 内置 Sharp（src-utools/src/inject.js 包装的 inject.sharp），本地处理不消耗模型。
 * - 用途：省钱工作流中，AI 把多个素材合并成一张 sprite 图一次生成，再用本工具切成多张，
 *   每张 path 填入画布 image 节点的 imageUrl（详见 canvas_guidelines("image-generation")）。
 * - 裁剪方式二选一：regions 显式区域（x/y/width/height）或 grid 网格（cols/rows/gap）。
 */
import type { ToolFunction } from '@/domain'
import { registerToolPolicy, type ToolPolicyContext } from '@/modules/tool/toolPolicy'

interface CropRegion {
  left: number
  top: number
  width: number
  height: number
}

const isPathUnder = (target: string, parent: string): boolean => {
  if (!target || !parent) return false
  const t = window.preload.path.normalizePath(target).replace(/\/$/, '')
  const p = window.preload.path.normalizePath(parent).replace(/\/$/, '')
  return t === p || t.startsWith(p + '/')
}

/** 归一化用户区域：取整、钳制到图片边界内、宽高至少为 1；完全越界返回 null */
const normalizeRegion = (
  raw: { x?: unknown; y?: unknown; width?: unknown; height?: unknown },
  width: number,
  height: number
): CropRegion | null => {
  const toInt = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback
  const left = Math.max(0, Math.min(toInt(raw.x, 0), width - 1))
  const top = Math.max(0, Math.min(toInt(raw.y, 0), height - 1))
  const w = Math.max(1, Math.min(toInt(raw.width, 0), width - left))
  const h = Math.max(1, Math.min(toInt(raw.height, 0), height - top))
  return { left, top, width: w, height: h }
}

/** 网格均分：把图片按 cols×rows 切块，可选 gap（单元格间距），末行 / 末列吸收余量保证全覆盖 */
const buildGridRegions = (
  width: number,
  height: number,
  cols: number,
  rows: number,
  gap = 0
): CropRegion[] => {
  const g = Math.max(0, Math.floor(gap))
  const cellW = Math.max(1, Math.floor((width - g * (cols - 1)) / cols))
  const cellH = Math.max(1, Math.floor((height - g * (rows - 1)) / rows))
  const regions: CropRegion[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const left = col * (cellW + g)
      const top = row * (cellH + g)
      if (left >= width || top >= height) continue
      regions.push({
        left,
        top,
        width: col === cols - 1 ? width - left : cellW,
        height: row === rows - 1 ? height - top : cellH
      })
    }
  }
  return regions
}

export const createImageCropTool = (): ToolFunction => ({
  name: 'image_crop',
  label: '裁剪图片',
  description:
    '将一张图片按指定区域（regions）或网格（grid）裁剪成多张 PNG 图片并保存，返回每张图片的本地路径（path）。' +
    '用于把「合并生成的一张 sprite 素材图」切分成多个独立素材，每个 path 填进画布 image 节点 imageUrl 即可。' +
    '裁剪在本地完成，不消耗生图模型额度。',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '源图片文件绝对路径（png / jpeg / webp 等）'
      },
      regions: {
        type: 'array',
        items: {
          type: 'object',
          description: '裁剪区域（左上角坐标 + 宽高）',
          properties: {
            x: { type: 'number', description: '区域左上角 x' },
            y: { type: 'number', description: '区域左上角 y' },
            width: { type: 'number', description: '区域宽度' },
            height: { type: 'number', description: '区域高度' }
          }
        },
        description: '显式裁剪区域列表（与 grid 二选一）；超出图片范围的部分自动钳制'
      },
      grid: {
        type: 'object',
        description: '等分网格裁剪（与 regions 二选一）',
        properties: {
          cols: { type: 'number', description: '列数（≥1）' },
          rows: { type: 'number', description: '行数（≥1）' },
          gap: { type: 'number', description: '单元格间距（px），适用于带留白的 sprite 图，默认 0' }
        },
        required: ['cols', 'rows']
      },
      outDir: {
        type: 'string',
        description: '输出目录（缺省为源图片所在目录）'
      }
    },
    required: ['path']
  },
  risk: 'sensitive',
  handler: async (...params: unknown[]) => {
    const { path: source, regions, grid, outDir } = params[0] as {
      path?: string
      regions?: Array<{ x?: number; y?: number; width?: number; height?: number }>
      grid?: { cols?: number; rows?: number; gap?: number }
      outDir?: string
    }

    if (!source) return { error: '缺少 path：请输入源图片文件路径' }
    const sharp = window.preload.inject.sharp
    if (!sharp) {
      return { error: '当前平台不支持 sharp 图像处理，无法裁剪图片（仅 uTools 环境可用）' }
    }

    const meta = await sharp.metadata(source)
    if (!meta.width || !meta.height) {
      return { error: `无法解析图片信息：${source}` }
    }
    const width = meta.width
    const height = meta.height

    let cropRegions: CropRegion[]
    if (regions?.length) {
      cropRegions = regions
        .map((r) => normalizeRegion(r, width, height))
        .filter((r): r is CropRegion => r !== null)
      if (cropRegions.length === 0) {
        return { error: 'regions 均为空或越界：请提供有效裁剪区域（x/y/width/height）' }
      }
    } else if (grid) {
      const cols = Math.max(1, Math.floor(grid.cols ?? 1))
      const rows = Math.max(1, Math.floor(grid.rows ?? 1))
      cropRegions = buildGridRegions(width, height, cols, rows, grid.gap)
    } else {
      return { error: 'regions 与 grid 至少填一个：显式区域或网格裁剪' }
    }

    const outDirResolved = outDir || window.preload.path.dirname(source)
    await window.preload.fs.mkdir(outDirResolved, true)
    const base = window.preload.path.basename(source, window.preload.path.extname(source))

    const images: Array<{ index: number; path: string; width: number; height: number }> = []
    for (let index = 0; index < cropRegions.length; index++) {
      const region = cropRegions[index]
      const output = window.preload.path.join(outDirResolved, `${base}_crop_${index}.png`)
      try {
        const info = await sharp.crop(source, region, output)
        images.push({
          index,
          path: output,
          width: info.width || region.width,
          height: info.height || region.height
        })
      } catch {
        return { error: `第 ${index} 个区域裁剪失败，请检查 region / grid 参数后重试` }
      }
    }

    return {
      success: true,
      source: { path: source, width, height },
      images,
      note:
        '已将源图裁剪为多张 PNG，把每个 path 填进画布 image 节点的 imageUrl；可用 image_info(path) 确认尺寸'
    }
  }
})

/**
 * image_crop 读写策略：源图与输出目录均需位于沙盒 / 工作空间 / 用户主目录（可信区）内自动放行，
 * 其余路径需用户审批（与 font_register 一致）。
 */
registerToolPolicy({
  name: 'image_crop',
  resolve(_tool, args, ctx: ToolPolicyContext) {
    const userDirs = [
      ctx.sandboxDir,
      ctx.workspace,
      window.preload.inject.os.getPath('home')
    ].filter(Boolean)
    const inTrusted = (v: unknown): boolean =>
      typeof v === 'string' && !!v && userDirs.some((dir) => isPathUnder(v, dir))
    const pathOk = !args.path || inTrusted(args.path)
    const outDirOk = !args.outDir || inTrusted(args.outDir)
    return pathOk && outDirOk ? 'allow' : 'ask'
  }
})
