/**
 * 卡片模板实例化与骨架基础样式：把风格自带的 HTML 模板（data-nc 插槽契约）填充为单页卡片内部 HTML。
 * 契约与清洗见 @/global/card-style-template；填充规则：
 * - data-nc="header"/"title"：首页填充，其余页与内容为空时该插槽元素移除（避免空元素占位）
 * - data-nc="content"：正文块注入点（始终保留，分页实测按它测量）
 * - data-nc="footer"：每页填充水印，空则移除
 */

/** 卡片间距（预览纵向排布与 #nc-root gap 共用） */
export const CARD_GAP = 16

/** 单页卡片的插槽内容（均为已转义的安全 HTML） */
export interface CardSlotContent {
  /** 卡头（作者头像 + 名字 + 日期），仅首页非空 */
  header: string
  /** 标题文字，仅首页非空 */
  title: string
  /** 本页正文块 */
  content: string
  /** 页尾水印文字 */
  footer: string
}

/** 默认骨架模板：与旧固定骨架 DOM 结构一致（空插槽移除后即为原结构） */
export const DEFAULT_CARD_TEMPLATE = [
  '<div class="nc-header" data-nc="header"></div>',
  '<h1 class="nc-title" data-nc="title"></h1>',
  '<div class="nc-content" data-nc="content"></div>',
  '<div class="nc-footer" data-nc="footer"></div>'
].join('\n')

/** 骨架基础 CSS（布局约束；.nc-content 需 position:relative 供分页量取 offsetTop） */
export const CARD_BASE_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent}
body{-webkit-font-smoothing:antialiased}
#nc-root{display:flex;flex-direction:column;gap:${CARD_GAP}px}
.nc-slot{overflow:hidden}
.note-card{width:360px;height:480px;transform-origin:top left;overflow:hidden;display:flex;flex-direction:column}
.nc-header{flex:none;display:flex;align-items:center;gap:8px;margin-bottom:14px}
.nc-avatar{width:28px;height:28px;border-radius:50%;object-fit:cover}
.nc-author{line-height:1.2}
.nc-date{display:block;margin-top:2px;font-style:normal;font-size:11px;opacity:.65}
.nc-title{flex:none}
.nc-content{flex:1;min-height:0;position:relative;overflow:hidden}
.nc-footer{flex:none;margin-top:12px;text-align:center}
.nc-content p{margin:0 0 .8em}
.nc-content p:last-child{margin-bottom:0}
.nc-content ul,.nc-content ol{margin:0 0 .8em;padding-left:1.4em}
.nc-content h1,.nc-content h2,.nc-content h3,.nc-content h4,.nc-content h5,.nc-content h6{margin:0 0 .6em;line-height:1.35}
.nc-content h1{font-size:1.5em}.nc-content h2{font-size:1.3em}.nc-content h3{font-size:1.2em}
.nc-content h4,.nc-content h5,.nc-content h6{font-size:1.1em}
.nc-content img{max-width:100%;display:block;margin:8px auto}
.nc-content blockquote{margin:0 0 .8em;padding:10px 12px;border-left:3px solid;border-radius:4px}
.nc-content blockquote p{margin:0}
.nc-content blockquote p:last-child{margin-bottom:0}
.nc-content hr{border:none;height:2px;width:40%;margin:1.2em auto}
.nc-content pre{padding:12px;border-radius:8px;background:rgba(128,128,128,.12);white-space:pre-wrap;word-break:break-all;margin:0 0 .8em}
.nc-content code{font-family:Menlo,Consolas,monospace;font-size:.9em}
`

/** 实例化模板：DOMParser 填充插槽（不执行脚本、不加载资源），返回卡片内部 HTML */
export const renderCardTemplate = (template: string, slots: CardSlotContent): string => {
  const doc = new DOMParser().parseFromString(template, 'text/html')
  const fill = (name: string, html: string) => {
    const el = doc.querySelector(`[data-nc="${name}"]`)
    if (!el) return
    if (html) el.innerHTML = html
    else el.remove()
  }
  fill('header', slots.header)
  fill('title', slots.title)
  fill('content', slots.content)
  fill('footer', slots.footer)
  return doc.body.innerHTML
}
