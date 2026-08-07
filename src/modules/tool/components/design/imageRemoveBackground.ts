/**
 * image_remove_background 工具：去除图片「从外到内的连续背景色」（flood fill）。
 * - 背景：生图模型不支持真透明，image_generate 产物通常带不透明白底，直接放进画布会盖住底层。
 *   本工具从图片四条边出发，凡与目标色（默认白）在容差内且与边缘连通的像素全部置为透明，
 *   输出带 alpha 的 PNG，叠加到画布任意底色上都自然融合。
 * - 实现：uTools 内置 Sharp 的 raw() 读像素 → 本地 BFS flood fill → PNG 写回
 *   （src-utools/src/inject.js 包装的 inject.sharp.removeBackground），不消耗生图模型额度。
 */
import type { ToolFunction } from '@/domain'
import { registerToolPolicy, type ToolPolicyContext } from '@/modules/tool/toolPolicy'
import { isPathUnder } from '@/utils/sandbox'

/** 解析目标背景色：hex（#ffffff）/ rgb() / [r,g,b]；非法返回 null */
const parseColor = (color: unknown): string | [number, number, number] | null => {
  if (typeof color === 'string') {
    if (/^#?[0-9a-fA-F]{6}$/.test(color.trim())) return color.trim()
    if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(color.trim())) return color.trim()
    return null
  }
  if (
    Array.isArray(color) &&
    color.length === 3 &&
    color.every((v) => typeof v === 'number' && Number.isFinite(v))
  ) {
    return [color[0], color[1], color[2]]
  }
  return null
}

/** 容差校验：0~255 数字，否则返回默认 40 */
const normalizeTolerance = (tolerance: unknown): number => {
  if (typeof tolerance === 'number' && Number.isFinite(tolerance)) {
    return Math.max(0, Math.min(255, Math.round(tolerance)))
  }
  return 40
}

export const createImageRemoveBackgroundTool = (): ToolFunction => ({
  name: 'image_remove_background',
  label: '去除背景',
  description:
    '去除图片「从外到内的连续背景色」：从图片四边边缘像素出发，凡与目标色在容差内且与边缘连通的像素' +
    '全部置为透明，输出带 alpha 的 PNG。生图模型不支持真透明（image_generate 产物通常带不透明白底，' +
    '直接放进画布会盖住底层背景），需要透明底素材时先用本工具去背景，再把返回的 path 填进画布 image 节点' +
    'imageUrl。处理在本地完成，不消耗生图模型额度。',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '源图片文件绝对路径（png / jpeg / webp 等，生图产物或裁剪产物均可）'
      },
      color: {
        type: 'string',
        description:
          '要去除的背景色：hex（#ffffff）/ rgb(r,g,b) / [r,g,b]，默认纯白。边缘与该色在容差内且连通的区域会被清成透明'
      },
      tolerance: {
        type: 'number',
        description:
          '颜色容差 0~255，默认 40。越大去除范围越广（含与背景接近的浅色，可能伤到主体边缘）；越小越严格，只去纯色'
      },
      output: {
        type: 'string',
        description: '输出图片保存路径（缺省为源图同目录下 {文件名}_no-bg.png）'
      }
    },
    required: ['path']
  },
  risk: 'sensitive',
  handler: async (...params: unknown[]) => {
    const {
      path: source,
      color,
      tolerance,
      output
    } = params[0] as {
      path?: string
      color?: unknown
      tolerance?: unknown
      output?: string
    }

    if (!source) return { error: '缺少 path：请输入源图片文件路径' }
    const sharp = window.preload.inject.sharp
    if (!sharp) {
      return { error: '当前平台不支持 sharp 图像处理，无法去除背景（仅 uTools 环境可用）' }
    }

    const resolvedColor = parseColor(color)
    if (color != null && !resolvedColor) {
      return { error: 'color 格式不支持：请用 hex（#ffffff）/ rgb(r,g,b) / [r,g,b]' }
    }

    const outDir = output
      ? window.preload.path.dirname(output)
      : window.preload.path.dirname(source)
    const base = window.preload.path.basename(source, window.preload.path.extname(source))
    const target = output || window.preload.path.join(outDir, `${base}_no-bg.png`)
    await window.preload.fs.mkdir(outDir, true)

    let result: { width: number; height: number; removedPixels: number }
    try {
      result = await sharp.removeBackground(
        source,
        {
          ...(resolvedColor ? { color: resolvedColor } : {}),
          tolerance: normalizeTolerance(tolerance)
        },
        target
      )
    } catch {
      return { error: '去除背景失败：请确认图片文件可读且格式受支持，或稍后重试' }
    }

    if (result.removedPixels === 0) {
      return {
        success: true,
        path: target,
        width: result.width,
        height: result.height,
        note: '未匹配到边缘背景色：主体可能占满整图或背景颜色不连续。可提高 tolerance 或改用 color 指定实际背景色后重试'
      }
    }

    return {
      success: true,
      path: target,
      width: result.width,
      height: result.height,
      removedPixels: result.removedPixels,
      note: '已将边缘连通背景置为透明（PNG 带 alpha），把 path 填进画布 image 节点的 imageUrl 即可叠加到任意底色'
    }
  }
})

/**
 * image_remove_background 读写策略：源图与输出路径均需位于沙盒 / 工作空间 / 用户主目录（可信区）内自动放行，
 * 其余路径需用户审批（与 image_crop 一致）。
 */
registerToolPolicy({
  name: 'image_remove_background',
  resolve(_tool, args, ctx: ToolPolicyContext) {
    const userDirs = [
      ctx.sandboxDir,
      ctx.workspace,
      window.preload.inject.os.getPath('home')
    ].filter(Boolean)
    const inTrusted = (v: unknown): boolean =>
      typeof v === 'string' && !!v && userDirs.some((dir) => isPathUnder(v, dir))
    const pathOk = !args.path || inTrusted(args.path)
    const outputOk = !args.output || inTrusted(args.output)
    return pathOk && outputOk ? 'allow' : 'ask'
  }
})
