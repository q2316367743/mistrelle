import { marked } from 'marked'

/**
 * 笔记卡片 markdown 渲染管线：md → HTML 块数组（供 iframe 卡片分页消费）。
 * - ==文字== 高亮标记在解析前替换为 <mark>（marked 原样保留内联 HTML，无需扩展协议）
 * - 渲染后做轻量清洗：剥离 script/iframe 等危险标签与 on* / javascript: 属性
 *   （内容为本地自产，清洗是纵深防御，零依赖实现）
 */

marked.use({ gfm: true, breaks: true })

/** ==高亮== → <mark>（marked 解析前预处理） */
const preprocessHighlight = (md: string): string => md.replace(/==([^=\n]+)==/g, '<mark>$1</mark>')

/** 危险标签整块移除 */
const DANGEROUS_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base']

/** 轻量清洗：去危险标签、on* 属性与 javascript: 协议链接 */
const sanitizeHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.body.querySelectorAll(DANGEROUS_TAGS.join(',')).forEach((el) => el.remove())
  doc.body.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name)
        continue
      }
      if ((name === 'href' || name === 'src') && attr.value.trim().toLowerCase().startsWith('javascript:')) {
        el.removeAttribute(attr.name)
      }
    }
  })
  return doc.body.innerHTML
}

/** markdown → 清洗后的 HTML */
export const renderMarkdownHtml = (md: string): string =>
  sanitizeHtml(marked.parse(preprocessHighlight(md), { async: false }))

/** 渲染后的 HTML 按顶层块切分（每块为自包含 HTML，分页以块为单位移动） */
export const splitHtmlBlocks = (html: string): string[] => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return [...doc.body.children].map((el) => el.outerHTML)
}

/** markdown → HTML 块数组（一条龙入口） */
export const markdownToBlocks = (md: string): string[] => splitHtmlBlocks(renderMarkdownHtml(md))

/** HTML 转义（笔记标题等纯文本插值用） */
export const escapeHtml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
