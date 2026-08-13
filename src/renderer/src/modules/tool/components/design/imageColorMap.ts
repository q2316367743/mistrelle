/**
 * image_color_map 工具：分析一张图片的颜色分布，返回全局主色 palette 与「突兀区域」anomalies。
 * - 本地 Sharp（src/main/src/sharp/image.ts 的 sharpColorMap）处理，不消耗模型。
 * - 用途：AI 判断合成图 / 画布某区域颜色是否与周围差距过大，直接读 anomalies 的
 *   deviation（LAB ΔE，与 8 邻域最大色差）即可定位突兀区域，无需对比整张网格。
 * - 网格按宽高比缩放（长边 gridSize 格），每格即该区域平均色；透明格自动剔除。
 */
import type { ToolFunction } from '@/domain'
import { registerToolPolicy, type ToolPolicyContext } from '@/modules/tool/toolPolicy'
import { isPathUnder } from '@/utils/sandbox'

const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.max(min, Math.min(max, Math.round(v)))
}

export const createImageColorMapTool = (): ToolFunction => ({
  name: 'image_color_map',
  label: '分析图片颜色',
  description:
    '分析一张图片的颜色分布，返回全局主色 palette 与突兀区域 anomalies（该格与周围 8 邻域的感知色差 LAB ΔE，按降序取 Top-N）。' +
    '用于判断图片 / 画布某个区域颜色是否与周围差距过大：直接看 anomalies 里 deviation 最大的项即可定位问题区。' +
    'deviation > 30 为明显突兀，15~30 为轻微；anomalies 的 x/y/width/height 为原图像素坐标。本地处理不消耗模型。',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '源图片文件绝对路径（png / jpeg / webp 等）'
      },
      grid: {
        type: 'number',
        description: '网格长边格数（4~48），默认 24；短边按图片宽高比缩放，格数越多分析越细'
      },
      top: {
        type: 'number',
        description: 'palette 与 anomalies 各返回条数（1~16），默认 8'
      }
    },
    required: ['path']
  },
  risk: 'sensitive',
  handler: async (...params: unknown[]) => {
    const { path: source, grid, top } = params[0] as { path?: string; grid?: number; top?: number }

    if (!source) return { error: '缺少 path：请输入源图片文件路径' }
    const sharp = window.preload.inject.sharp

    const gridSize = clampInt(grid, 4, 48, 24)
    const topN = clampInt(top, 1, 16, 8)

    try {
      const result = await sharp.colorMap(source, gridSize, topN)
      if (result.anomalies.length === 0 && result.palette.length === 0) {
        return {
          success: true,
          source: { path: source, width: result.width, height: result.height },
          cols: result.cols,
          rows: result.rows,
          palette: [],
          anomalies: [],
          note: '图片无可分析的不透明区域（可能整图透明），无需做颜色调整。'
        }
      }
      return {
        success: true,
        source: { path: source, width: result.width, height: result.height },
        cols: result.cols,
        rows: result.rows,
        palette: result.palette,
        anomalies: result.anomalies,
        note:
          'palette 为全局主色（ratio 为占比）；anomalies 按与周围 8 邻域的最大 LAB ΔE 降序，' +
          'deviation 越大颜色越突兀：>30 明显突兀、15~30 轻微。坐标（x/y/width/height）为原图像素，可直接用于定位画布区域。'
      }
    } catch {
      return { error: `图片颜色分析失败，请确认 ${source} 是有效的图片文件后重试` }
    }
  }
})

/**
 * image_color_map 读写策略：源图需位于沙盒 / 工作空间 / 用户主目录（可信区）内自动放行，
 * 其余路径需用户审批（与 image_crop / image_remove_background 一致）。
 */
registerToolPolicy({
  name: 'image_color_map',
  resolve(_tool, args, ctx: ToolPolicyContext) {
    const userDirs = [
      ctx.sandboxDir,
      ctx.workspace,
      window.preload.inject.os.getPath('home')
    ].filter(Boolean)
    const inTrusted = (v: unknown): boolean =>
      typeof v === 'string' && !!v && userDirs.some((dir) => isPathUnder(v, dir))
    return !args.path || inTrusted(args.path) ? 'allow' : 'ask'
  }
})
