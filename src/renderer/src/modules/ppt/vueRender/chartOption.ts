/**
 * Chart 节点 attr → echarts option（PptChart 预览与 pngPaint 位图导出共用，
 * 保证两条链路对同一 attr 渲染一致）。
 */
import type { EChartsOption } from 'echarts'

export interface ChartSeries {
  name: string
  labels: string[]
  values: number[]
}

export const parseChartSeries = (raw: string | undefined): ChartSeries[] => {
  try {
    const parsed = JSON.parse(raw ?? '[]') as ChartSeries[]
    return Array.isArray(parsed) ? parsed.filter((s) => Array.isArray(s.values)) : []
  } catch {
    return []
  }
}

const parseChartColors = (raw: string | undefined): string[] | undefined => {
  try {
    const parsed = JSON.parse(raw ?? 'null') as string[] | null
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

/** 系列 → echarts option（bar/line/area/pie/doughnut/radar） */
export const buildChartOption = (attr: Record<string, string>): EChartsOption => {
  const series = parseChartSeries(attr.data)
  const type = attr.chartType ?? 'bar'
  const sparkline = attr.sparkline === 'true'
  const colors = parseChartColors(attr.chartColors)
  const showLegend = attr.showLegend === 'true' && !sparkline
  const showTitle = attr.showTitle === 'true' && !sparkline && Boolean(attr.title)

  const option: EChartsOption = { animation: false, backgroundColor: 'transparent' }
  if (colors) option.color = colors
  if (showTitle) {
    option.title = { text: attr.title, left: 'center', top: 0, textStyle: { fontSize: 14 } }
  }
  if (showLegend) option.legend = { bottom: 0 }

  if (type === 'pie' || type === 'doughnut') {
    const first = series[0]
    option.series = [
      {
        type: 'pie',
        radius: type === 'doughnut' ? ['42%', '68%'] : '68%',
        center: ['50%', '52%'],
        data: (first?.labels ?? []).map((label, i) => ({
          name: label,
          value: first?.values?.[i] ?? 0
        })),
        label: sparkline ? { show: false } : { formatter: '{b}: {c}' }
      }
    ]
    return option
  }
  if (type === 'radar') {
    const first = series[0]
    const max = Math.max(1, ...(first?.values ?? [1]))
    option.radar = {
      indicator: (first?.labels ?? []).map((name) => ({ name, max })),
      radius: '62%'
    }
    const style = attr.radarStyle
    option.series = [
      {
        type: 'radar',
        data: series.map((s) => ({
          name: s.name,
          value: s.values,
          areaStyle: style === 'filled' ? { opacity: 0.35 } : undefined,
          symbol: style === 'standard' ? 'none' : 'circle'
        }))
      }
    ]
    return option
  }
  // bar / line / area：类目轴 + 多系列
  const labels = series[0]?.labels ?? []
  option.xAxis = { type: 'category', data: labels, show: !sparkline }
  option.yAxis = sparkline
    ? { type: 'value', show: false, splitLine: { show: false } }
    : { type: 'value' }
  option.grid = sparkline
    ? { left: 0, right: 0, top: 0, bottom: 0 }
    : {
        left: 8,
        right: 8,
        top: showTitle ? 30 : 10,
        bottom: showLegend ? 26 : 8,
        containLabel: true
      }
  if (type === 'bar') {
    option.series = series.map((s) => ({ type: 'bar' as const, data: s.values }))
  } else {
    option.series = series.map((s) => ({
      type: 'line' as const,
      data: s.values,
      areaStyle: type === 'area' ? { opacity: 0.3 } : undefined,
      smooth: type === 'line' || type === 'area'
    }))
  }
  return option
}
