/**
 * 参考站的导入管线（1:1 移植）：图片读入降采样、Markdown / Word / 剪贴板 HTML → 内容文本 + [img] 标记。
 */

import type { XhsImage } from './protocol'

/** File → dataURL */
export const readFileAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

/** src → 带宽高的图片对象 */
export const loadImageMeta = (src: string): Promise<XhsImage> =>
  new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ src, w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve({ src, w: 4, h: 3 })
    img.src = src
  })

const DOWNSCALE_MAX = 1200
const DOWNSCALE_AREA = 1200 * 1200
const DOWNSCALE_SRC_MIN = 400 * 1024

/** 大图降采样为 JPEG（GIF 跳过），控制导出体积 */
export const downscaleImage = async (image: XhsImage): Promise<XhsImage> => {
  if (/^data:image\/gif/i.test(image.src) || /\.gif(\?|#|$)/i.test(image.src)) return image
  const oversized = image.w * image.h > DOWNSCALE_AREA
  const bigDataUrl = image.src.startsWith('data:') && image.src.length > DOWNSCALE_SRC_MIN
  if (!oversized && !bigDataUrl) return image
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = image.src
    })
    const scale = Math.min(1, DOWNSCALE_MAX / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return image
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    const jpeg = canvas.toDataURL('image/jpeg', 0.82)
    return jpeg.length >= image.src.length ? image : { src: jpeg, w, h }
  } catch {
    return image
  }
}

/** File → 带尺寸的 XhsImage */
export const fileToImage = async (file: File): Promise<XhsImage> =>
  downscaleImage(await loadImageMeta(await readFileAsDataURL(file)))

const fetchBlobWithTimeout = async (url: string, cors: boolean): Promise<Blob> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(url, cors ? { mode: 'cors', signal: controller.signal } : { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) throw new Error('not an image')
    return blob
  } finally {
    clearTimeout(timer)
  }
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

/** 远程 / 相对图片 URL → dataURL（失败回落原 URL） */
export const loadRemoteImage = async (url: string): Promise<string> => {
  if (url.startsWith('data:')) return url
  if (url.startsWith('blob:')) {
    try {
      return await blobToDataUrl(await fetchBlobWithTimeout(url, false))
    } catch {
      return url
    }
  }
  try {
    return await blobToDataUrl(await fetchBlobWithTimeout(url, true))
  } catch {
    return url
  }
}

/** HTML 块级标签集合（换行判定） */
const BLOCK_TAGS = new Set([
  'P', 'DIV', 'LI', 'UL', 'OL', 'TR', 'TABLE', 'THEAD', 'TBODY',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'SECTION', 'ARTICLE',
  'HEADER', 'FOOTER', 'PRE', 'HR'
])

/** HTML → 内容文本（strong/标题转 **加粗**、图片转 [img] 标记并收集图片地址） */
export const htmlToContent = async (html: string): Promise<{ text: string; images: Array<string> }> => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const images: Array<string> = []
  let text = ''
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += (node.nodeValue || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ')
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    const tag = el.tagName
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return
    if (tag === 'STRONG' || tag === 'B' || /^H[1-6]$/.test(tag)) {
      const start = text.length
      for (const child of Array.from(node.childNodes)) walk(child)
      const inner = text.slice(start)
      if (inner.trim()) text = text.slice(0, start) + '**' + inner.trim() + '**'
      if (BLOCK_TAGS.has(tag)) text += '\n'
      return
    }
    if (tag === 'IMG') {
      const src = el.getAttribute('src')
      if (src && !src.startsWith('about:')) {
        images.push(src)
        text += '\n[img]\n'
      }
      return
    }
    if (tag === 'BR') {
      text += '\n'
      return
    }
    for (const child of Array.from(node.childNodes)) walk(child)
    if (BLOCK_TAGS.has(tag)) text += '\n'
  }
  walk(doc.body)
  // 图片地址统一转 dataURL（导出画布不可被跨域污染，与参考站一致）
  const loaded = await Promise.all(
    images.map(async (src) => {
      try {
        return await loadRemoteImage(src)
      } catch {
        return null
      }
    })
  )
  return { text: text.replace(/\n{3,}/g, '\n\n').trim(), images: loaded.filter((src): src is string => !!src) }
}

/** Markdown 特征打分（≥2 分视为 Markdown） */
export const looksLikeMarkdown = (text: string): boolean => {
  let score = 0
  if (/^\s{0,3}#{1,6}\s+\S/m.test(text)) score += 2
  if (/!\[[^\]]*\]\([^)]+\)/.test(text)) score += 3
  if (/\[[^\]]+\]\(https?:[^)]+\)/.test(text)) score += 2
  if ((text.match(/^\s*[-*+]\s+\S/gm) || []).length >= 2) score += 2
  if ((text.match(/^\s{0,3}>\s?\S/gm) || []).length >= 2) score += 1
  if (/\*\*[^*\n]+\*\*/.test(text)) score += 1
  if (/==[^=\n]+==/.test(text)) score += 1
  return score >= 2
}

/** Markdown 文本 → 内容文本（图片下载为 dataURL，标题转加粗、列表转 ·、去引用/代码标记） */
export const markdownToContent = async (
  md: string
): Promise<{ text: string; images: Array<XhsImage> }> => {
  const dataUrls: Array<string> = []
  const lines: Array<string> = []
  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    let line = raw
    const imgRe = /!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g
    if (imgRe.test(line)) {
      imgRe.lastIndex = 0
      const parts: Array<string> = []
      let last = 0
      for (let m = imgRe.exec(line); m; m = imgRe.exec(line)) {
        parts.push(line.slice(last, m.index))
        last = m.index + m[0].length
        const url = m[1]
        const absolute = /^(data:|blob:|https?:)/i.test(url) ? url : new URL(url, window.location.href).href
        try {
          dataUrls.push(await loadRemoteImage(absolute))
          parts.push('\n[img]\n')
        } catch {
          /* 单图失败跳过 */
        }
      }
      parts.push(line.slice(last))
      line = parts.join('')
    }
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.*)$/)
    if (heading) line = `**${heading[1].trim()}**`
    line = line.replace(/^\s{0,3}>\s?/, '')
    line = line.replace(/^(\s*)[-*+]\s+/, '$1· ')
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) line = ''
    line = line.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    line = line.replace(/__([^_\n]+)__/g, '**$1**')
    line = line.replace(new RegExp('(?<!\\*)\\*([^*\\n]+)\\*(?!\\*)', 'g'), '$1')
    line = line.replace(new RegExp('(?<!\\w)_([^_\\n]+)_(?!\\w)', 'g'), '$1')
    line = line.replace(/`([^`]*)`/g, '$1')
    lines.push(line.replace(/\s+$/u, ''))
  }
  const text = lines
    .join('\n')
    .split('\n')
    .map((l) => l.replace(/^[ \t]+|[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
  const images: Array<XhsImage> = []
  for (const src of dataUrls) images.push(await loadImageMeta(src))
  return { text, images }
}

/** Word（.docx）→ 内容文本（mammoth 懒加载转 HTML 后走 htmlToContent） */
export const wordToContent = async (
  arrayBuffer: ArrayBuffer
): Promise<{ text: string; images: Array<string> }> => {
  const mammoth = await import('mammoth')
  const api = 'default' in mammoth && mammoth.default ? mammoth.default : mammoth
  const result = await api.convertToHtml({ arrayBuffer })
  return htmlToContent(result.value)
}
