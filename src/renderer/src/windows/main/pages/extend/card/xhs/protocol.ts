/**
 * 笔记卡片渲染协议：1:1 移植自参考站 jinsan.ok.kimi.link（XHS Card Studio）的
 * 内容解析（[img] 标记 / **加粗** / ==高亮==）、分页（oh）与量测换行（Zm）逻辑，
 * 常量与其构建产物逐值一致；卡片风格（注册表键值对）经 buildXhsRuntime 注入，
 * 不选风格时全部取参考站默认值（视觉 1:1）。
 */

export interface XhsImage {
  src: string
  w: number
  h: number
}

export interface XhsSegment {
  type: 'text' | 'image'
  content?: string
  index?: number
}

export interface XhsToken {
  text: string
  bold: boolean
  hl: boolean
}

export interface XhsItem {
  si: number
  adjH: number
}

export interface XhsPage {
  items: Array<XhsItem>
  fullBleed: boolean
  pageH?: number
}

/** 参考站常量（页面逻辑宽度 400、3:4 最小高、正文 15px/1.8 等），逐值一致 */
export const PAGE_W = 400
export const PAGE_MIN_H = (PAGE_W * 4) / 3
export const HEADER_H = 54
export const WATERMARK_H = 44
export const FULL_BLEED_PAD = 28
export const FULL_BLEED_MAX_H = (PAGE_W * 11) / 4
export const IMAGE_FULL_BLEED_H = 480
export const IMAGE_MAX_INLINE_H = 260
export const IMAGE_MIN_SHRINK_H = 120
export const HL_COLOR = '#FFF1A8'
export const EXPORT_SCALE = 3

/** 默认运行时（= 参考站原样） */
export const DEFAULT_RUNTIME: XhsRuntime = {
  cardBg: '#FFFFFF',
  textColor: '#1A1A1A',
  hlBg: HL_COLOR,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
  fontSize: 15,
  lineHeight: 1.8,
  blockGap: 18,
  padding: 32,
  contentWidth: PAGE_W - 64,
  cardRadius: 24,
  imageRadius: 12,
  dateColor: '#888888',
  watermarkColor: '#C0C0C0',
  watermarkSize: 12
}

/** 卡片风格运行时参数（渲染与导出共用的全部外观决策） */
export interface XhsRuntime {
  cardBg: string
  textColor: string
  hlBg: string
  fontFamily: string
  fontSize: number
  /** 行高倍率（参考站 1.8） */
  lineHeight: number
  /** 块间距 px（参考站 1.2em = 18） */
  blockGap: number
  padding: number
  contentWidth: number
  cardRadius: number
  imageRadius: number
  dateColor: string
  watermarkColor: string
  watermarkSize: number
}

/** 由卡片风格键值对构建运行时；不传 / 缺键回落参考站默认值 */
export const buildXhsRuntime = (props?: Record<string, string>): XhsRuntime => {
  if (!props) return DEFAULT_RUNTIME
  const num = (key: string, fb: number) => {
    const n = Number.parseFloat(props[key] ?? '')
    return Number.isNaN(n) ? fb : n
  }
  const padding = num('card.padding', 32)
  const fontSize = num('body.size', 15)
  const font = props['card.font'] ? `'${props['card.font']}', ` : ''
  return {
    cardBg: props['card.background'] || DEFAULT_RUNTIME.cardBg,
    textColor: props['card.color'] || DEFAULT_RUNTIME.textColor,
    hlBg: props['body.highlight'] || DEFAULT_RUNTIME.hlBg,
    fontFamily: `${font}${DEFAULT_RUNTIME.fontFamily}`,
    fontSize,
    lineHeight: num('body.lineHeight', 1.8),
    blockGap: Math.round(fontSize * 1.2),
    padding,
    contentWidth: PAGE_W - padding * 2,
    cardRadius: num('card.radius', 24),
    imageRadius: num('image.radius', 12),
    dateColor: props['author.color'] || DEFAULT_RUNTIME.dateColor,
    watermarkColor: props['footer.color'] || DEFAULT_RUNTIME.watermarkColor,
    watermarkSize: num('footer.size', 12)
  }
}

/** 行内标记：**加粗** / ==高亮==（支持嵌套，递归解析） */
const INLINE_RE = '\\*\\*([^*\\n]+)\\*\\*|==([^=\\n]+)=='

export const parseInlineTokens = (
  text: string,
  inherited: XhsToken = { text: '', bold: false, hl: false }
): Array<XhsToken> => {
  const re = new RegExp(INLINE_RE, 'g')
  const out: Array<XhsToken> = []
  let last = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), bold: inherited.bold, hl: inherited.hl })
    const inner = m[1] !== undefined ? m[1] : m[2]
    const style = m[1] !== undefined ? { ...inherited, bold: true } : { ...inherited, hl: true }
    out.push(...parseInlineTokens(inner, style))
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: inherited.bold, hl: inherited.hl })
  return out
}

/** 内容解析：按行拆段；[img] / [img2] 标记配图位置，无标记时配图依序插到开头 */
export const parseSegments = (content: string, imageCount: number): Array<XhsSegment> => {
  const segments: Array<XhsSegment> = []
  let autoIndex = 0
  let hasMark = false
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    const mark = trimmed.match(/^\[img(\d{0,2})\]$/i)
    if (mark) {
      hasMark = true
      const idx = mark[1] ? parseInt(mark[1], 10) - 1 : autoIndex++
      if (idx >= 0 && idx < imageCount) segments.push({ type: 'image', index: idx })
    } else if (trimmed.length > 0) {
      segments.push({ type: 'text', content: line.replace(/\s+$/u, '') })
    }
  }
  if (!hasMark && imageCount > 0) {
    for (let i = imageCount - 1; i >= 0; i--) segments.unshift({ type: 'image', index: i })
  }
  return segments
}

/** 行内配图块高度：按内容宽等比，超出上限压到上限 */
export const imageBlockHeight = (image?: XhsImage, contentWidth: number = PAGE_W - 64): number =>
  !image || !image.w || !image.h ? 200 : Math.min((contentWidth * image.h) / image.w, IMAGE_MAX_INLINE_H)

/**
 * 分页（参考站 oh 的逐值移植）：
 * - 首页扣除作者卡头占位，每页扣除页尾水印占位
 * - 高图（>480）独占整页（fullBleed，页高按宽缩放并封顶）
 * - 剩余空间足够时压高容纳图片，否则整页放下
 */
export const paginateXhs = (
  items: Array<{ kind: 'text' | 'image'; h: number; im?: XhsImage }>,
  hasWatermark: boolean,
  rt: XhsRuntime
): Array<XhsPage> => {
  if (items.length === 0) return [{ items: [], fullBleed: false }]
  const marginY = rt.padding * 2
  const watermarkBlock = hasWatermark ? WATERMARK_H : 0
  const avail = (page: number) => PAGE_MIN_H - marginY - (page === 0 ? HEADER_H : 0) - watermarkBlock - 2
  const pages: Array<XhsPage> = []
  let cur: Array<XhsItem> = []
  let used = 0
  const flush = () => {
    if (cur.length) pages.push({ items: cur, fullBleed: false })
    cur = []
    used = 0
  }
  items.forEach((item, index) => {
    const gap = cur.length > 0 ? rt.blockGap : 0
    if (item.kind === 'image') {
      const naturalH =
        item.im && item.im.w > 0 && item.im.h > 0 ? (rt.contentWidth * item.im.h) / item.im.w : item.h
      if (naturalH > IMAGE_FULL_BLEED_H) {
        flush()
        const pad = FULL_BLEED_PAD
        const scaled = naturalH * ((PAGE_W - pad * 2) / rt.contentWidth)
        const pageH = Math.min(scaled + pad * 2 + (hasWatermark ? WATERMARK_H + 8 : 0), FULL_BLEED_MAX_H)
        pages.push({ items: [{ si: index, adjH: 0 }], fullBleed: true, pageH })
        return
      }
      const remain = avail(pages.length) - used - gap
      if (item.h <= remain) {
        cur.push({ si: index, adjH: item.h })
        used += gap + item.h
      } else if (remain >= IMAGE_MIN_SHRINK_H) {
        cur.push({ si: index, adjH: remain })
        used += gap + remain
      } else {
        flush()
        pages.push({ items: [{ si: index, adjH: 0 }], fullBleed: true })
      }
      return
    }
    if (cur.length > 0 && used + gap + item.h > avail(pages.length)) flush()
    cur.push({ si: index, adjH: item.h })
    used += (cur.length > 1 ? rt.blockGap : 0) + item.h
  })
  flush()
  return pages.length ? pages : [{ items: [], fullBleed: false }]
}

