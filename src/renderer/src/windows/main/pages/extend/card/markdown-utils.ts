import { renderMarkdownHtml, splitHtmlBlocks } from '@/components/card/note-markdown'

/**
 * Markdown 卡片主页面工具：Markdown 源码 → 富 HTML 块数组（供 NoteCardRenderer 消费）。
 * - 图片 ![](url) 在 marked 前先统一下载为 dataURL（避免导出 iframe 被跨域污染、外链失效）
 * - 相对 / blob / http 地址均尝试下载，失败保留原 URL
 */

const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g

/** 从 Markdown 里抽出全部图片 url，逐个转 dataURL；返回 url→dataURL 映射 */
export const downloadMarkdownImages = async (md: string): Promise<Map<string, string>> => {
  const map = new Map<string, string>()
  const urls: Array<string> = []
  for (const m of md.matchAll(IMG_RE)) {
    const url = m[2].trim().split(/\s+/u)[0]
    if (!urls.includes(url)) urls.push(url)
  }
  await Promise.all(
    urls.map(async (url) => {
      try {
        const resolved = /^(data:|blob:|https?:)/i.test(url)
          ? url
          : new URL(url, window.location.href).href
        const blob = await (await fetch(resolved)).blob()
        if (!blob.type.startsWith('image/')) throw new Error('not image')
        map.set(url, await blobToDataUrl(blob))
      } catch {
        /* 失败保留原 URL */
      }
    })
  )
  return map
}

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

/** Markdown → 富 HTML 块（图片已替换为 dataURL） */
export const markdownToCardBlocks = async (md: string): Promise<Array<string>> => {
  const map = await downloadMarkdownImages(md)
  let html = md
  if (map.size) {
    html = md.replace(IMG_RE, (raw, alt, src) => {
      const url = src.trim().split(/\s+/u)[0]
      const data = map.get(url)
      return data ? `![${alt}](${data})` : raw
    })
  }
  return splitHtmlBlocks(renderMarkdownHtml(html))
}
