import {
  EXPORT_SCALE,
  PAGE_W,
  parseSegments,
  paginateXhs,
  imageBlockHeight,
  type XhsImage,
  type XhsRuntime
} from './protocol'
import { buildCardHtml, buildMeasurerInnerHtml, type CardMeta } from './card-html'

/** 导出入参（与参考站 ah 的参数一致，额外携带卡片风格运行时） */
export interface XhsExportParams {
  content: string
  nickname: string
  dateStr: string
  avatar?: string | null
  images: Array<XhsImage>
  watermark: string
  runtime: XhsRuntime
}

/** 等待容器内全部图片加载完成（dataURL 秒回，远程图靠 load/error 事件） */
const waitImages = async (root: HTMLElement) => {
  const pending = [...root.querySelectorAll('img')].filter(
    (img) => !(img as HTMLImageElement).complete
  )
  if (pending.length) {
    await Promise.all(
      pending.map(
        (img) =>
          new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true })
            img.addEventListener('error', () => resolve(), { once: true })
          })
      )
    )
  }
  await new Promise((resolve) => setTimeout(resolve, 60))
}

/**
 * 导出（@zumer/snapdom 方案）：
 * 在屏幕外容器渲染与预览完全同源的卡片 HTML（card-html 单一事实源），
 * 等图片就绪后逐张 snapdom 截取为 EXPORT_SCALE 倍高清 PNG dataURL；
 * 单张直接下载、多张由调用方 jszip 打包，接口与旧 Canvas 版一致。
 */
export const exportXhsCards = async (params: XhsExportParams): Promise<Array<string>> => {
  const { content, nickname, dateStr, avatar, images, watermark, runtime: rt } = params
  const host = document.createElement('div')
  // 屏幕外渲染（不可用 display:none / visibility:hidden，否则截图为空白）
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W}px;font-family:${rt.fontFamily}`
  document.body.appendChild(host)
  try {
    // 1) 量测：与预览同构的隐藏容器量取每块真实高度
    const segments = parseSegments(content, images.length)
    host.innerHTML = `<div style="width:${rt.contentWidth}px;font-size:${rt.fontSize}px;line-height:${rt.lineHeight}">${buildMeasurerInnerHtml(segments, images, rt)}</div>`
    const measurer = host.firstElementChild as HTMLElement
    const heights = [...measurer.children].map((el) => (el as HTMLElement).offsetHeight)
    const items = segments.map((seg, i) =>
      seg.type === 'text'
        ? { kind: 'text' as const, h: heights[i] || Math.round(rt.fontSize * rt.lineHeight) }
        : {
            kind: 'image' as const,
            h: imageBlockHeight(images[seg.index ?? 0], rt.contentWidth),
            im: images[seg.index ?? 0]
          }
    )
    const pages = paginateXhs(items, !!watermark, rt)

    // 2) 渲染卡片并等图片就绪
    const meta: CardMeta = { nickname, dateStr, avatar, watermark }
    host.innerHTML = pages
      .map((page, i) => buildCardHtml(page, segments, images, rt, meta, i))
      .join('')
    await waitImages(host)

    // 3) snapdom 逐张捕获
    const { snapdom } = await import('@zumer/snapdom')
    const outputs: Array<string> = []
    for (const el of [...host.querySelectorAll('.card-canvas')]) {
      const result = await snapdom(el, { scale: EXPORT_SCALE })
      const img = await result.toPng()
      outputs.push(img.src)
    }
    return outputs
  } finally {
    host.remove()
  }
}
