/**
 * 公众号排版风格类型（GzhStyleStore / gzhStyleService / gzhStyleTools 共用契约）。
 * styles 的键 = 元素选择器白名单（GZH_STYLE_ELEMENT_KEYS），值 = 完整内联 style 字符串
 * （公众号编辑器禁 <style> 标签与外部 CSS，样式必须全内联）。
 */

/** 元素 → 内联 style 映射 */
export type GzhStyleMap = Record<string, string>

/** 用户自建排版风格条目（index.json 索引与单条文件共用的存储形状） */
export interface GzhStyleItem {
  id: string
  name: string
  description: string
  styles: GzhStyleMap
  createdAt: number
  updatedAt: number
}

/** 完整风格：内置预设 isSystem=true 只读；用户自建 isSystem=false */
export interface GzhStyle extends GzhStyleItem {
  isSystem: boolean
}

/** 创建 / 编辑表单（id 与时间戳由 store 派生） */
export interface GzhStyleForm {
  name: string
  description: string
  styles: GzhStyleMap
}

/** 渲染器支持的元素选择器白名单（tagName 小写；`pre code` 为成对键，覆盖 pre 内代码块底色） */
export const GZH_STYLE_ELEMENT_KEYS: ReadonlyArray<string> = [
  'section',
  'h1',
  'h2',
  'h3',
  'p',
  'strong',
  'em',
  'del',
  'a',
  'blockquote',
  'ul',
  'ol',
  'li',
  'code',
  'pre',
  'pre code',
  'table',
  'th',
  'td',
  'img',
  'hr'
]
