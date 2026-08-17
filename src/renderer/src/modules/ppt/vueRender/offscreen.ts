/**
 * 离屏快照服务：文档 JSON → 挂全部页 PptSlideSurface（不可见但参与布局）→
 * 等待资源稳定（图片 / 图表 / 字体）→ snapshotSlide 逐页采集 → 卸载。
 * 用户导出按钮与 AI 导出工具共用（aside 未打开时也可导出，只需 renderer 存活）。
 */
import { createApp, defineComponent, h, nextTick } from 'vue'
import { cloneDeep } from 'es-toolkit'
import type { PptExportSnapshot, PptJsonDoc } from '../pptTypes'
import { PPT_SLIDE_SIZE } from '../pptTypes'
import { ensureNodeIds } from '../pptNodeId'
import PptSlideSurface from './PptSlideSurface.vue'
import { snapshotSlide } from './snapshot'
import { waitSrcResolved } from './resolveSrc'

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
  const host = document.createElement('div')
  host.setAttribute('data-ppt-offscreen', '1')
  // 不可见但保持布局（display:none 不参与布局，无法测量）
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${size.w}px;opacity:0;pointer-events:none;`
  document.body.appendChild(host)

  const container = defineComponent({
    setup() {
      return () =>
        h(
          'div',
          doc.slide.map((slide, i) => h(PptSlideSurface, { key: i, slide, theme: doc.theme, size }))
        )
    }
  })
  const app = createApp(container)
  app.mount(host)
  try {
    await waitSrcResolved()
    await waitRendered(host, 6000)
    await document.fonts.ready
    await nextTick()
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    const surfaces = Array.from(host.querySelectorAll('[data-ppt-surface]')) as HTMLElement[]
    const slides = surfaces.map((el, i) => snapshotSlide(el, doc.slide[i] ?? [], doc.theme))
    return { w: size.w, h: size.h, slides }
  } finally {
    app.unmount()
    host.remove()
  }
}
