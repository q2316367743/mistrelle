/**
 * 离屏快照服务：文档 JSON → 挂 PptSlideSurface（不可见但参与布局）→
 * 等待资源稳定（图片 / 图表 / 字体）→ snapshotSlide 逐页采集 / measureSlideBounds 逐节点测量 → 卸载。
 * 用户导出按钮与 AI 导出 / 检查工具共用（aside 未打开时也可用，只需 renderer 存活）。
 */
import { createApp, defineComponent, h, nextTick, type App } from 'vue'
import { cloneDeep } from 'es-toolkit'
import type { PptExportSnapshot, PptJsonDoc, PptTheme, SlideNode } from '../pptTypes'
import { PPT_SLIDE_SIZE } from '../pptTypes'
import { ensureNodeIds } from '../pptNodeId'
import PptSlideSurface from './PptSlideSurface.vue'
import { snapshotSlide } from './snapshot'
import { waitSrcResolved } from './resolveSrc'
import { localRect } from './overlayLinks'

/** 等待页内资源渲染完成：本地图片解析 + <img> 加载 + 图表 SSR 产出 svg */
const waitRendered = async (host: HTMLElement, timeoutMs: number): Promise<void> => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 120))
    const images = Array.from(host.querySelectorAll('img'))
    if (images.some((img) => !img.complete)) continue
    const charts = Array.from(host.querySelectorAll('.ppt-chart'))
    if (charts.some((chart) => !chart.querySelector('svg'))) continue
    return
  }
}

/** 挂载离屏 host（不可见但保持布局，display:none 不参与布局无法测量） */
const mountOffscreen = (
  slides: SlideNode[][],
  theme: PptTheme,
  size: { w: number; h: number }
): { host: HTMLElement; app: App<Element> } => {
  const host = document.createElement('div')
  host.setAttribute('data-ppt-offscreen', '1')
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${size.w}px;opacity:0;pointer-events:none;`
  document.body.appendChild(host)

  const container = defineComponent({
    setup() {
      return () =>
        h(
          'div',
          slides.map((slide, i) => h(PptSlideSurface, { key: i, slide, theme, size }))
        )
    }
  })
  const app = createApp(container)
  app.mount(host)
  return { host, app }
}

/** 等待挂载内容渲染稳定：src 解析 → 图片 / 图表 → 字体 → 帧渲染 */
const waitStable = async (host: HTMLElement): Promise<void> => {
  await waitSrcResolved()
  await waitRendered(host, 6000)
  await document.fonts.ready
  await nextTick()
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
}

/**
 * 采集整份文档快照（导出 PPTX / PNG 的渲染侧入口）。
 * @param json PptJsonDoc（传入副本即被克隆，不污染原对象）
 */
export const snapshotDoc = async (
  json: PptJsonDoc,
  size: { w: number; h: number } = PPT_SLIDE_SIZE
): Promise<PptExportSnapshot> => {
  const doc = cloneDeep(json)
  doc.slide.forEach(ensureNodeIds)
  const { host, app } = mountOffscreen(doc.slide, doc.theme, size)
  try {
    await waitStable(host)
    const surfaces = Array.from(host.querySelectorAll('[data-ppt-surface]')) as HTMLElement[]
    const slides = surfaces.map((el, i) => snapshotSlide(el, doc.slide[i] ?? [], doc.theme))
    return { w: size.w, h: size.h, slides }
  } finally {
    app.unmount()
    host.remove()
  }
}

/** 节点渲染几何（画布绝对坐标，ppt_inspect 返回；纯几何与定位字段，不含内容——内容看 ppt_get_nodes） */
export interface PptNodeBounds {
  id: string
  tag: string
  parentId?: string
  depth: number
  x: number
  y: number
  width: number
  height: number
  centerX: number
  centerY: number
}

const round2 = (value: number): number => Math.round(value * 100) / 100

/**
 * 离屏挂载单页并实测每个节点根元素的包围盒（相对 surface 的画布绝对坐标）。
 * 与预览 / 导出同一渲染层（CSS 布局真相），容器 / 复合节点子项 / overlay（Line / Arrow）均可测。
 */
export const measureSlideBounds = async (
  slide: SlideNode[],
  theme: PptTheme,
  size: { w: number; h: number } = PPT_SLIDE_SIZE
): Promise<PptNodeBounds[]> => {
  const nodes = cloneDeep(slide)
  ensureNodeIds(nodes)
  const { host, app } = mountOffscreen([nodes], theme, size)
  try {
    await waitStable(host)
    const surface = host.querySelector('[data-ppt-surface]')
    if (!(surface instanceof HTMLElement)) return []
    const base = surface.getBoundingClientRect()
    const result: PptNodeBounds[] = []
    const walk = (list: SlideNode[], parentId: string | undefined, depth: number): void => {
      for (const node of list) {
        const el = node.id ? surface.querySelector(`[data-node-id="${node.id}"]`) : null
        if (el) {
          const rect = localRect(el, base)
          result.push({
            id: node.id ?? '',
            tag: node.tag,
            parentId,
            depth,
            x: round2(rect.x),
            y: round2(rect.y),
            width: round2(rect.w),
            height: round2(rect.h),
            centerX: round2(rect.x + rect.w / 2),
            centerY: round2(rect.y + rect.h / 2)
          })
        }
        if (Array.isArray(node.child)) walk(node.child, node.id, depth + 1)
      }
    }
    walk(nodes, undefined, 0)
    return result
  } finally {
    app.unmount()
    host.remove()
  }
}
