/**
 * 公众号排版本地渲染：Markdown + 风格样式映射 → 内联样式 HTML。
 * 替代原「AI 全文转 HTML」：marked 解析 + 离屏 DOM 注入 style 属性，
 * 零 token、毫秒级完成；产物为 <section id="gzh-content"> 纯片段（样式全内联），
 * 预览（resolveGzhLayoutImages / buildGzhPreviewDoc）与复制（copyGzhLayoutToClipboard）管线不变。
 * styles 来源：内置预设（gzhStylePresets）或样式库自建风格（GzhStyleStore）。
 */
import { marked } from 'marked'

/** google 内置预设的小节四色轮换（蓝 / 红 / 黄 / 绿标记） */
const GOOGLE_H2_COLORS = ['#1a73e8', '#d93025', '#e37400', '#188038']
const GOOGLE_H2_BGS = ['#f1f6fd', '#fce8e6', '#fef7e0', '#e6f4ea']

marked.use({ gfm: true, breaks: true })

/**
 * 本地排版：markdown + styles（元素 → 内联 style 映射）→ <section id="gzh-content"> 片段。
 * styleId 用于内置预设特判（google 小节四色轮换）；同步零依赖运行时（离屏 DOM 操作），
 * 图片 src 保留 md 相对路径由预览 / 复制管线转换。
 */
export const renderGzhLayout = (
  content: string,
  styles: Record<string, string>,
  styleId?: string
): string => {
  const host = document.createElement('div')
  host.innerHTML = marked.parse(content.trim(), { async: false })
  host.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const css = styles[el.tagName.toLowerCase()]
    if (css) el.setAttribute('style', css)
  })
  // pre 内 code 后处理覆盖（通用注入会给它行内 code 的底色）
  const preCodeCss = styles['pre code']
  if (preCodeCss) {
    host
      .querySelectorAll<HTMLElement>('pre > code')
      .forEach((el) => el.setAttribute('style', preCodeCss))
  }
  // google 预设：小节标题四色轮换（在 h2 基础样式上覆盖 color / background）
  if (styleId === 'google' && styles.h2) {
    let index = 0
    host.querySelectorAll<HTMLElement>('h2').forEach((el) => {
      const i = index++
      el.setAttribute(
        'style',
        `${styles.h2};color:${GOOGLE_H2_COLORS[i % 4]};background:${GOOGLE_H2_BGS[i % 4]};`
      )
    })
  }
  return `<section id="gzh-content">${host.innerHTML}</section>`
}
