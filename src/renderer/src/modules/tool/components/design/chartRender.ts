/**
 * ECharts SSR 图表渲染助手（纯转换，与画布 / 工具解耦，可复用）：
 * 把 echarts option 渲染为 SVG 字符串，供 leafer 画布 / PPT / 其他场景以图片形式使用。
 * - 采用 echarts SVG 渲染器 + SSR 模式（无 DOM 依赖），支持 echarts 全部内置图表类型
 *   （line/bar/pie/scatter/effectScatter/radar/funnel/gauge/heatmap/tree/treemap/sankey/
 *   graph/map/boxplot/candlestick/parallel/lines/sunburst/themeRiver/pictorialBar/custom 等）
 * - 产物为静态矢量 SVG：无动画 / 交互 / tooltip（leafer 按图片加载，动画 SSR 也不可用）
 * - 透明背景、viewBox 定位；leafer 侧用 Platform.toURL(svg,'svg') 或落盘 .svg 文件加载
 * - echarts 全量包经动态 import 代码分割，仅首次调用时加载，不膨胀渲染主包
 */
import type { EChartsOption } from 'echarts'

let echartsModule: Promise<typeof import('echarts')> | null = null

/** 动态加载 echarts（全量 + SVG 渲染器），缓存模块引用 */
const loadECharts = (): Promise<typeof import('echarts')> => {
  echartsModule ??= (async () => {
    const echarts = await import('echarts')
    await import('echarts/renderers') // 副作用：注册 SVG 渲染器
    return echarts
  })()
  return echartsModule
}

/**
 * 把 echarts option 渲染为 SVG 字符串（SSR 同步产出，await 仅用于首次加载模块）。
 * @param option echarts option（series / xAxis / yAxis / color 等，见 echarts 官方文档）
 * @param width 输出宽度（px）——SSR 无容器无法自动测量，必须显式指定
 * @param height 输出高度（px）
 * @returns SVG 字符串（透明背景，viewBox 定位，可无损缩放）
 */
export const renderChartOptionToSVG = async (
  option: EChartsOption,
  width: number,
  height: number
): Promise<string> => {
  const echarts = await loadECharts()
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height })
  try {
    chart.setOption({ animation: false, backgroundColor: 'transparent', ...option })
    return chart.renderToSVGString({ useViewBox: true })
  } finally {
    chart.dispose()
  }
}
