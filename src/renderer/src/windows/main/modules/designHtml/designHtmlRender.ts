/**
 * HTML 引擎渲染管线：预览与导出共用。
 *
 * 流程：AI 源码（已清洗）→ 图片引用解析为 dataURL（本地路径 / 网络图，防 iframe 无法加载
 * 本地路径与 snapdom 跨域污染 canvas）→ 注入基础画布样式（body 即固定尺寸画布）→ 完整文档。
 * 导出走屏幕外 iframe + @zumer/snapdom（与笔记卡片 NoteCardRenderer 同一成熟模式）。
 */
import { arrayBufferToBase64 } from '@/utils/file/CovertUtil'
import type { HtmlDesignDoc } from './designHtmlDoc'

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  avif: 'image/avif',
  bmp: 'image/bmp'
}

const extOf = (ref: string): string => {
  const clean = ref.split(/[?#]/)[0]
  const ext = /\.([a-zA-Z0-9]+)$/.exec(clean)?.[1]?.toLowerCase()
  return ext && IMAGE_MIME[ext] ? ext : ''
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

const isLocalPath = (ref: string): boolean =>
  ref.startsWith('/') || ref.startsWith('~') || /^[a-zA-Z]:[\\/]/.test(ref)

const readLocalDataUrl = async (path: string): Promise<string | null> => {
  const ext = extOf(path)
  if (!ext) return null
  try {
    if (!window.preload.fs.existsSync(path)) return null
    const buffer = await window.preload.fs.readBinaryFile(path)
    return `data:${IMAGE_MIME[ext]};base64,${arrayBufferToBase64(buffer)}`
  } catch {
    return null
  }
}

const fetchRemoteDataUrl = async (url: string): Promise<string | null> => {
  try {
    const blob = await (await fetch(url)).blob()
    if (!blob.type.startsWith('image/')) return null
    return await blobToDataUrl(blob)
  } catch {
    return null
  }
}

/** 防御性上限：单文档最多解析 40 个图片引用，超出保留原样 */
const MAX_IMAGE_REFS = 40

/**
 * 收集 HTML 中的图片引用（<img src> 与 CSS url()），本地 / 网络图统一转 dataURL。
 * 源文件保持 AI 原貌（便于 html_read 回读与再编辑），仅在渲染装配时转换。
 */
export const resolveDesignHtmlImages = async (html: string): Promise<string> => {
  const refs = new Set<string>()
  for (const m of html.matchAll(/\ssrc\s*=\s*"([^"]+)"/gi)) refs.add(m[1])
  for (const m of html.matchAll(/\ssrc\s*=\s*'([^']+)'/gi)) refs.add(m[1])
  for (const m of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) refs.add(m[1])
  const targets = [...refs]
    .filter((ref) => !ref.startsWith('data:') && !ref.startsWith('#'))
    .slice(0, MAX_IMAGE_REFS)
  await Promise.all(
    targets.map(async (ref) => {
      const dataUrl = isLocalPath(ref)
        ? await readLocalDataUrl(ref)
        : ref.startsWith('http')
          ? await fetchRemoteDataUrl(ref)
          : null
      if (dataUrl) html = html.split(ref).join(dataUrl)
    })
  )
  return html
}

/** 基础画布样式：body 即固定尺寸设计画布（注入在 AI 样式之后，强制尺寸契约） */
const buildBaseStyle = (doc: HtmlDesignDoc): string =>
  `<style id="design-base">html,body{margin:0;padding:0}body{width:${doc.width}px;height:${doc.height}px;overflow:hidden;position:relative}</style>`

/** 装配预览 / 导出用的完整文档：图片 dataURL 化 + 注入基础画布样式 */
export const prepareDesignHtmlDocument = async (doc: HtmlDesignDoc): Promise<string> => {
  const resolved = await resolveDesignHtmlImages(doc.html)
  const base = buildBaseStyle(doc)
  if (/<\/head\s*>/i.test(resolved)) {
    return resolved.replace(/<\/head\s*>/i, `${base}</head>`)
  }
  const bodyOpen = /<body[^>]*>/i.exec(resolved)
  if (bodyOpen) {
    return resolved.replace(bodyOpen[0], `${bodyOpen[0]}${base}`)
  }
  return `${base}${resolved}`
}

/** 等待文档内全部图片加载完成（load / error 均算结束；8 秒兜底防悬挂） */
const waitImagesSettled = (frameDoc: Document): Promise<void> => {
  const pending = [...frameDoc.querySelectorAll('img')].filter(
    (img) => !(img as HTMLImageElement).complete
  )
  if (!pending.length) return Promise.resolve()
  return Promise.race([
    Promise.all(
      pending.map(
        (img) =>
          new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true })
            img.addEventListener('error', () => resolve(), { once: true })
          })
      )
    ).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 8000))
  ])
}

/** 创建屏幕外渲染 iframe（预览复用同款安全约束：同源可写、禁脚本） */
export const createDesignHtmlFrame = (doc: HtmlDesignDoc): HTMLIFrameElement => {
  const frame = document.createElement('iframe')
  frame.setAttribute('sandbox', 'allow-same-origin')
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${doc.width}px;height:${doc.height}px;border:0`
  document.body.appendChild(frame)
  return frame
}

/**
 * 将设计稿渲染导出为 PNG Blob（1:1 逻辑尺寸 × scale 像素密度）。
 * 屏幕外 iframe 渲染不影响预览；字体（document.fonts）与图片加载完成后经 snapdom 截取 body。
 */
export const exportDesignHtmlPng = async (doc: HtmlDesignDoc, scale = 2): Promise<Blob> => {
  const frame = createDesignHtmlFrame(doc)
  try {
    const frameDoc = frame.contentDocument
    if (!frameDoc) throw new Error('无法创建导出 iframe')
    frameDoc.open()
    frameDoc.write(await prepareDesignHtmlDocument(doc))
    frameDoc.close()
    await frameDoc.fonts.ready
    await waitImagesSettled(frameDoc)
    const { snapdom } = await import('@zumer/snapdom')
    const result = await snapdom(frameDoc.body, { scale })
    return await result.toBlob({ type: 'png' })
  } finally {
    frame.remove()
  }
}
