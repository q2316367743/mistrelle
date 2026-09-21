/**
 * 公众号排版下游管线：预览与复制的共用装配（gzhLayoutRender 的消费方）。
 * - resolveGzhLayoutImages：渲染片段中的图片引用（md 相对路径 / 绝对路径 / 网络图）→ dataURL
 * - buildGzhPreviewDoc：装配完整预览文档（iframe srcdoc 用，677px 内容宽）
 * - copyGzhLayoutToClipboard：text/html + text/plain 双写（公众号编辑器识别富文本粘贴）
 */
import { arrayBufferToBase64 } from '@/utils/file/CovertUtil'

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  bmp: 'image/bmp'
}

/** 防御性上限：单篇最多解析 40 个图片引用，超出保留原样 */
const MAX_IMAGE_REFS = 40

const extMimeOf = (ref: string): string | null => {
  const clean = ref.split(/[?#]/)[0]
  const ext = /\.([a-zA-Z0-9]+)$/.exec(clean)?.[1]?.toLowerCase()
  return ext && IMAGE_MIME[ext] ? IMAGE_MIME[ext] : null
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

const readLocalDataUrl = async (path: string): Promise<string | null> => {
  const mime = extMimeOf(path)
  if (!mime) return null
  try {
    if (!window.preload.fs.existsSync(path)) return null
    const buffer = await window.preload.fs.readBinaryFile(path)
    return `data:${mime};base64,${arrayBufferToBase64(buffer)}`
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

/** md 相对路径 → 绝对路径（基于正文 md 所在目录解析；已是绝对 / 网络引用原样返回） */
const toAbsolute = (ref: string, baseDir: string): string => {
  if (baseDir && !/^([a-zA-Z]:[\\/]|\/|~|https?:)/.test(ref)) {
    return window.preload.path.join(baseDir, ref)
  }
  return ref
}

/**
 * 解析渲染片段中的图片引用为 dataURL（本地路径经 baseDir 补全相对路径，网络图直接抓取）。
 * 解析失败的引用保留原样（预览可见裂图，复制后公众号端同裂，问题不被静默吞掉）。
 */
export const resolveGzhLayoutImages = async (html: string, baseDir: string): Promise<string> => {
  const refs = new Set<string>()
  for (const m of html.matchAll(/\ssrc\s*=\s*"([^"]+)"/gi)) refs.add(m[1])
  for (const m of html.matchAll(/\ssrc\s*=\s*'([^']+)'/gi)) refs.add(m[1])
  const targets = [...refs]
    .filter((ref) => !ref.startsWith('data:') && !ref.startsWith('#'))
    .slice(0, MAX_IMAGE_REFS)
  await Promise.all(
    targets.map(async (ref) => {
      const absolute = toAbsolute(ref, baseDir)
      const dataUrl = /^https?:/.test(absolute)
        ? await fetchRemoteDataUrl(absolute)
        : await readLocalDataUrl(absolute)
      if (dataUrl) html = html.split(ref).join(dataUrl)
    })
  )
  return html
}

/** 预览基础样式：页面留白清零 + 677px 内容宽（与公众号编辑器一致） */
const PREVIEW_BASE_STYLE =
  '<style id="gzh-preview-base">html,body{margin:0;padding:0;background:#ffffff}#gzh-content{max-width:677px;margin:0 auto;padding:12px 0;box-sizing:border-box}img{max-width:100%}</style>'

/** 装配预览完整文档（iframe srcdoc 用）：图片 dataURL 化 + 基础样式 */
export const buildGzhPreviewDoc = async (fragment: string, baseDir: string): Promise<string> => {
  const resolved = await resolveGzhLayoutImages(fragment, baseDir)
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${PREVIEW_BASE_STYLE}</head><body>${resolved}</body></html>`
}

/** 富文本剪贴板写入（text/html + text/plain 双写；Clipboard API 失败回退 execCommand） */
export const copyGzhLayoutToClipboard = async (html: string, text: string): Promise<void> => {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })
      ])
      return
    }
  } catch {
    // 落入 execCommand 兜底
  }
  const host = document.createElement('div')
  host.contentEditable = 'true'
  host.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0'
  host.innerHTML = html
  document.body.appendChild(host)
  const range = document.createRange()
  range.selectNodeContents(host)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  try {
    const ok = document.execCommand('copy', false)
    host.remove()
    selection?.removeAllRanges()
    if (!ok) throw new Error('execCommand 复制失败')
  } catch (e) {
    host.remove()
    throw e
  }
}
