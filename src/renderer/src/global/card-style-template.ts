/**
 * 卡片风格自由层（HTML 模板 + 自定义 CSS）的契约与清洗。
 *
 * 卡片风格为三层结构：
 * - props：注册表白名单键值对（@/global/card-style-props），快捷结构化调整
 * - template：可选 HTML 模板，经 data-nc 插槽标记与渲染器建立契约；空 = 默认骨架
 * - css：可选自由 CSS，最后注入 iframe，可覆盖注册表属性与骨架样式
 *
 * 模板渲染在固定画布 .note-card（360×480，overflow:hidden）内部，
 * 画布尺寸、缩放与导出机制不受模板影响；实测装箱分页测量 [data-nc="content"]。
 * 模板与 CSS 均为自由文本，落盘 / 渲染前必须经本文件归一清洗（防结构破坏与脚本注入）。
 */

/** 模板长度上限（字符），超限视为非法整体剔除（截断 HTML 会产出残缺结构） */
const TEMPLATE_MAX_LENGTH = 20000

/** 自定义 CSS 长度上限（字符），超限截断（CSS 截断只丢尾部规则，安全） */
const CSS_MAX_LENGTH = 8000

/** 清洗会破坏宿主文档结构或注入脚本的片段：脚本与样式标签、事件属性、js 协议、闭合标签逃逸 */
const stripDangerous = (raw: string): string =>
  raw
    .replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(script|style|iframe|object|embed|link|meta|base|form)[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<\/(style|body|html)[^>]*>/gi, '')

/**
 * 归一自定义 CSS：剔除 </style 闭合序列（防 doc.write 逃逸）、超长截断。
 * 输出恒为合法可注入文本（空串表示无自定义 CSS）。
 */
export const normalizeCardStyleCss = (raw: unknown): string => {
  if (raw == null) return ''
  return String(raw)
    .replace(/<\/style[^>]*>/gi, '')
    .trim()
    .slice(0, CSS_MAX_LENGTH)
}

/**
 * 归一 HTML 模板：清洗危险片段、超长整体剔除；
 * 缺 data-nc="content" 插槽的模板无法承载正文与分页，同样整体剔除（回退默认骨架）。
 */
export const normalizeCardStyleTemplate = (raw: unknown): string => {
  if (raw == null) return ''
  const str = stripDangerous(String(raw)).trim()
  if (!str || str.length > TEMPLATE_MAX_LENGTH) return ''
  if (!/data-nc\s*=\s*["']content["']/i.test(str)) return ''
  return str
}

/** 面向 AI 的模板插槽契约说明（工具 schema / 提示词共用） */
export const describeCardStyleSlots = (): string =>
  [
    'HTML 模板通过 data-nc 属性声明插槽，渲染器逐页实例化模板并填充内容：',
    '- data-nc="content"：正文插槽，必填（markdown 正文块注入点，分页按它实测测量；缺失则整条模板作废回退默认骨架）',
    '- data-nc="header"：卡头插槽，可选（首页填充作者头像+名字+日期；某页无内容时该元素被移除）',
    '- data-nc="title"：标题插槽，可选（仅首页填充标题文字）',
    '- data-nc="footer"：页尾插槽，可选（每页填充水印文字）',
    '模板约束：',
    '- 模板渲染在固定画布 .note-card 内（360×480、overflow:hidden），根元素应占满画布（width/height 100%）',
    '- 只写结构与装饰；正文内元素（p/h1-h6/ul/ol/img/blockquote/hr/pre/code/mark/strong/a）的排版由基础样式提供，可用自定义 CSS 覆盖',
    '- 禁止 script、事件属性、外链资源（系统剔除，含这些内容的模板整体作废）；长度上限 20000 字符'
  ].join('\n')

/** 面向 AI 的自定义 CSS 说明 */
export const describeCardStyleCss = (): string =>
  [
    '自定义 CSS 在注册表属性与骨架样式之后注入（可覆盖两者）：',
    '- 可作用于 .note-card 画布、模板自定义类名与骨架类名（.nc-header/.nc-avatar/.nc-author/.nc-date/.nc-title/.nc-content/.nc-footer）',
    '- 适合做注册表表达不了的效果：渐变纹理背景（repeating-linear-gradient）、伪元素装饰（::before/::after）、纸纹与信纸横线等',
    "- 禁止出现 </style 闭合序列（系统剔除）；长度上限 8000 字符"
  ].join('\n')
