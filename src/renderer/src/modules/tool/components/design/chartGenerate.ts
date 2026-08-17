/**
 * chart_generate 工具：把 echarts option 渲染成 SVG 图表落盘沙盒，返回本地路径。
 * - 支持 echarts 全部内置图表类型（柱状 / 折线 / 饼图 / 散点 / 雷达 / 漏斗 / 仪表盘 /
 *   热力 / 树图 / 矩形树图 / 桑基 / 关系图 / 地图 / 箱线 / K线 / 平行坐标 / 旭日 / 主题河流 等）
 * - 产物是静态矢量 SVG（无动画 / 交互 / tooltip——leafer 按图片加载的固有限制）
 * - 返回的 path 填进 svg 节点 imageUrl（或 image 节点）即可，渲染层自动转 file 协议；
 *   SVG 内颜色是渲染时写死的固定值（不参与 $token 调色板替换），需按画布调色板取实色
 * - 需要更新数据时重新调用本工具生成新文件，再 update 节点 imageUrl
 */
import type { EChartsOption } from 'echarts'
import type { ToolFunction } from '@/domain'
import { registerToolPolicy } from '@/modules/tool/toolPolicy'
import { renderChartOptionToSVG } from './chartRender'
import type { DesignToolContext } from './websiteLogo'

/** 默认输出路径：{sandboxDir}/outputs/charts/chart-{时间戳}.svg */
const buildDefaultOutputPath = (sandboxDir: string): string => {
  const chartsDir = window.preload.path.join(sandboxDir, 'outputs', 'charts')
  return window.preload.path.join(chartsDir, `chart-${Date.now()}.svg`)
}

/** 尺寸上限（px），防止 AI 传离谱尺寸撑爆渲染 */
const MAX_SIZE = 4096

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isValidSize = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_SIZE

export const createChartGenerateTool = (ctx: DesignToolContext): ToolFunction => ({
  name: 'chart_generate',
  label: '生成图表',
  description:
    '把 echarts option 渲染成专业数据图表（SVG 矢量图）落盘沙盒 outputs/charts/，返回本地绝对路径（path）。' +
    '支持 echarts 全部内置图表类型：bar 柱状 / line 折线 / pie 饼图（含环形）/ scatter 散点 / radar 雷达 / ' +
    'funnel 漏斗 / gauge 仪表盘 / heatmap 热力 / tree 树图 / treemap 矩形树图 / sankey 桑基 / graph 关系图 / ' +
    'map 地图 / boxplot 箱线 / candlestick K线 / parallel 平行坐标 / sunburst 旭日 / themeRiver 主题河流 / ' +
    'pictorialBar 象形柱 / effectScatter 涟漪散点 / lines 轨迹线 / custom 自定义 等，option 按 echarts 官方配置书写。' +
    '把返回的 path 填进画布 svg 节点的 imageUrl（或 image 节点 imageUrl），并显式设置 width/height 为返回值尺寸。' +
    '注意：图表是静态矢量图（无动画 / 交互 / tooltip），option 不要写 animation 相关配置；' +
    'SVG 内颜色为渲染时写死的固定值（不走 $token 替换），颜色请直接取画布调色板实色（如 #E63946）保持全页和谐；' +
    '透明背景，适合叠在任意底色上。',
  parameters: {
    type: 'object',
    properties: {
      option: {
        type: 'object',
        additionalProperties: true,
        description:
          '完整 echarts option 对象（JSON）：series 数组（每项含 type 图表类型 / data 数据 / itemStyle 配色等）、' +
          'xAxis / yAxis / radar / legend / title 等配置，按 echarts 官方文档书写；颜色用与画布调色板一致的实色'
      },
      width: {
        type: 'number',
        description: '图表输出宽度（px），必填，如 600'
      },
      height: {
        type: 'number',
        description: '图表输出高度（px），必填，如 400'
      }
    },
    required: ['option', 'width', 'height']
  },
  handler: async (...params: unknown[]) => {
    const { option, width, height } = params[0] as {
      option?: unknown
      width?: unknown
      height?: unknown
    }

    if (!isPlainObject(option) || Object.keys(option).length === 0) {
      return { error: '缺少 option：请输入完整的 echarts option 对象（含 series 等配置）' }
    }
    if (!isValidSize(width) || !isValidSize(height)) {
      return {
        error: `width / height 必须为 1~${MAX_SIZE} 的正整数，收到 width=${String(width)} height=${String(height)}`
      }
    }

    const sandboxDir = ctx.getSandboxDir()
    if (!sandboxDir) return { error: '缺少可用沙盒目录：无法落盘图表文件' }

    const path = buildDefaultOutputPath(sandboxDir)
    try {
      const svg = await renderChartOptionToSVG(option as EChartsOption, width, height)
      await window.preload.fs.mkdir(window.preload.path.dirname(path), true)
      await window.preload.fs.writeTextFile(path, svg)
    } catch (error) {
      return { error: `图表渲染失败：${error instanceof Error ? error.message : String(error)}` }
    }

    return {
      success: true,
      path,
      width,
      height,
      note: '图表已生成：把 path 填进画布 svg 节点 imageUrl（或 image 节点），显式设置 width/height 为返回值尺寸；图表为静态矢量图'
    }
  }
})

/**
 * chart_generate 写入策略：路径由 handler 自动生成在沙盒 outputs/charts/（可信区），
 * 不接收外部路径，默认模式（mode=0）直接放行（与 canvas_* 工具一致）。
 */
registerToolPolicy({
  name: 'chart_generate',
  resolve: () => 'allow'
})
