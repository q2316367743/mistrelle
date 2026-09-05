import {
  FULL_BLEED_PAD,
  PAGE_MIN_H,
  PAGE_W,
  imageBlockHeight,
  parseInlineTokens,
  type XhsImage,
  type XhsPage,
  type XhsRuntime,
  type XhsSegment
} from './protocol'

/**
 * 卡片页面 HTML 构建（单一事实源）：
 * PreviewCard 的实时预览与 exporter 的屏幕外导出渲染共用同一份构建函数，
 * 保证「所见即所得」由结构保证而不是两套实现互相模仿。
 */

export const escapeHtml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/** 行内标记 HTML：==高亮== → mark、**加粗** → strong（嵌套样式与参考站一致） */
export const tokensHtml = (content: string, hlBg: string): string =>
  parseInlineTokens(content)
    .map((tok) => {
      let inner = escapeHtml(tok.text)
      if (tok.hl)
        inner = `<mark style="background:${hlBg};color:inherit;border-radius:3px;padding:0 2px">${inner}</mark>`
      if (tok.bold) inner = `<strong style="font-weight:600">${inner}</strong>`
      return `<span>${inner}</span>`
    })
    .join('')

/** 作者信息（首页卡头入参） */
export interface CardMeta {
  nickname: string
  dateStr: string
  avatar?: string | null
  watermark: string
}

const headerHtml = (meta: CardMeta, rt: XhsRuntime): string => `
  <div class="flex items-center gap-3 mb-4">
    <div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-[#F5F5F5]">
      ${
        meta.avatar
          ? `<img src="${escapeHtml(meta.avatar)}" alt="avatar" class="w-full h-full object-cover" />`
          : `<div class="w-full h-full flex items-center justify-center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`
      }
    </div>
    <div class="flex flex-col">
      <span class="text-sm font-semibold leading-tight" style="color:${rt.textColor}">${escapeHtml(meta.nickname || '昵称')}</span>
      <span class="text-xs leading-tight mt-0.5" style="color:${rt.dateColor}">${escapeHtml(meta.dateStr || '2026-04-23')}</span>
    </div>
  </div>`

const watermarkHtml = (meta: CardMeta, rt: XhsRuntime, variant: 'normal' | 'fullBleed'): string =>
  variant === 'fullBleed'
    ? `<div class="mt-4 pt-4 pb-4 border-t border-[#F0F0F0] text-right flex-shrink-0"><span class="text-xs" style="color:${rt.watermarkColor};font-size:${rt.watermarkSize}px">${escapeHtml(meta.watermark)}</span></div>`
    : `<div class="mt-auto pt-6 border-t border-[#F0F0F0] text-right"><span style="color:${rt.watermarkColor};font-size:${rt.watermarkSize}px">${escapeHtml(meta.watermark)}</span></div>`

const blockHtml = (seg: XhsSegment, adjH: number, images: Array<XhsImage>, rt: XhsRuntime): string => {
  if (seg.type === 'text') return `<p>${tokensHtml(seg.content ?? '', rt.hlBg)}</p>`
  const index = seg.index ?? 0
  const image = images[index]
  const natural = image && image.w > 0 && image.h > 0 ? (rt.contentWidth * image.h) / image.w : 200
  const h = adjH ?? Math.min(natural, 260)
  const style =
    h < natural - 0.5
      ? `height:${h}px;width:auto;max-width:100%;border-radius:${rt.imageRadius}px`
      : `width:100%;height:auto;border-radius:${rt.imageRadius}px`
  return `<div class="w-full flex justify-center"><img src="${escapeHtml(image?.src ?? '')}" alt="图${index + 1}" style="${style}" /></div>`
}

const PLACEHOLDER = `<p class="text-[#888]">这里会显示你的文章内容...</p>`

/** 构建单张卡片 HTML（结构与 PreviewCard 逐属性一致；isFirst 时含作者卡头） */
export const buildCardHtml = (
  page: XhsPage,
  segments: Array<XhsSegment>,
  images: Array<XhsImage>,
  rt: XhsRuntime,
  meta: CardMeta,
  pageIndex: number
): string => {
  const footer = meta.watermark ? watermarkHtml(meta, rt, page.fullBleed ? 'fullBleed' : 'normal') : ''
  if (page.fullBleed) {
    const seg = segments[page.items[0]?.si]
    const image = seg?.type === 'image' ? images[seg.index ?? 0] : null
    const body = image
      ? `<div class="flex-1 min-h-0 flex items-center justify-center"><img src="${escapeHtml(image.src)}" alt="图${(seg.index ?? 0) + 1}" class="border border-[#F0F0F0]" style="max-width:100%;max-height:100%;object-fit:contain;display:block;border-radius:${rt.imageRadius}px;box-shadow:0 4px 16px -6px rgba(0, 0, 0, 0.06)" /></div>`
      : ''
    return (
      `<section class="card-canvas export-page" style="width:${PAGE_W}px;height:${page.pageH ?? PAGE_MIN_H}px;border-radius:${rt.cardRadius}px;overflow:hidden;box-shadow:0 12px 40px -12px rgba(0, 0, 0, 0.08);background:${rt.cardBg};padding:${FULL_BLEED_PAD}px ${FULL_BLEED_PAD}px 0;display:flex;flex-direction:column">` +
      body +
      footer +
      `</section>`
    )
  }
  const blocks =
    page.items.length > 0
      ? page.items.map((item) => blockHtml(segments[item.si], item.adjH, images, rt)).join('')
      : PLACEHOLDER
  const header = pageIndex === 0 ? headerHtml(meta, rt) : ''
  return (
    `<section class="card-canvas export-page" style="width:${PAGE_W}px;min-height:${PAGE_MIN_H}px;background:${rt.cardBg};border-radius:${rt.cardRadius}px;box-shadow:0 12px 40px -12px rgba(0, 0, 0, 0.08);padding:${rt.padding}px;position:relative;overflow:hidden;display:flex;flex-direction:column">` +
    header +
    `<div class="card-content-text flex-1" style="color:${rt.textColor};font-size:${rt.fontSize}px;line-height:${rt.lineHeight};gap:${rt.blockGap}px">${blocks}</div>` +
    footer +
    `</section>`
  )
}

/** 量测容器内层 HTML（与卡片段落同构，供 offsetHeight 实测分页） */
export const buildMeasurerInnerHtml = (
  segments: Array<XhsSegment>,
  images: Array<XhsImage>,
  rt: XhsRuntime
): string =>
  segments
    .map((seg) =>
      seg.type === 'text'
        ? `<p style="margin:0;white-space:pre-wrap;overflow-wrap:break-word">${tokensHtml(seg.content ?? '', rt.hlBg)}</p>`
        : `<div style="height:${imageBlockHeight(images[seg.index ?? 0], rt.contentWidth)}px"></div>`
    )
    .join('')
