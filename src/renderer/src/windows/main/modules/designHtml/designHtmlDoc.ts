/**
 * HTML 引擎文档契约（纯函数，无状态）。
 *
 * 设计稿 = 一个自包含 HTML 文件（outputs/html-{version}.html），AI 产出整页源码；
 * 尺寸 / 标题等元信息嵌在 `<html>` 根标签的 data-design-* 属性上（文件可直接双击打开，
 * 读取侧无需第二份元数据文件）。落盘 / 渲染前必须经 sanitizeDesignHtml 清洗：
 * 预览 iframe 为同源 about:blank，脚本会触达 window.preload，必须剔除。
 */

/** HTML 设计稿长度上限（字符），超限视为非法整体拒绝（截断会产出残缺结构） */
export const HTML_DESIGN_MAX_LENGTH = 400_000

const FILE_PREFIX = 'html-'
const FILE_EXT = '.html'
const fileRegex = /^html-(\d+)\.html$/

/** 解析文件名版本号，非 HTML 设计稿文件返回 null */
export const parseDesignHtmlVersion = (name: string): number | null => {
  const match = fileRegex.exec(name)
  return match ? Number(match[1]) : null
}

export const buildDesignHtmlFileName = (version: number): string =>
  `${FILE_PREFIX}${version}${FILE_EXT}`

/** 输出目录与画布引擎共用：~/.mistrelle/workspace/{chatId}/outputs */
export const buildDesignHtmlOutputsDir = (sandboxDir: string): string =>
  window.preload.path.join(sandboxDir, 'outputs')

/** HTML 设计稿文档（内存形态：源码 + 元信息） */
export interface HtmlDesignDoc {
  name: string
  version: number
  title?: string
  width: number
  height: number
  html: string
}

/** outputs/ 下的设计稿文件索引项 */
export interface HtmlDesignFileInfo {
  name: string
  version: number
  title?: string
  path: string
  updatedTime: number
}

/**
 * 清洗 AI 产出的 HTML：剔除脚本与可执行协议、外链框架 / 表单等危险标签。
 * 与卡片模板的 stripDangerous 不同：设计稿依赖内联 `<style>`，必须保留样式标签。
 * script 连内容整块删除，其余只删标签保留内容，输出仍为完整可渲染文档。
 */
export const sanitizeDesignHtml = (raw: string): string =>
  raw
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<\/?(script|iframe|object|embed|link|base|form)[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')

const META_W = 'data-design-w'
const META_H = 'data-design-h'
const META_TITLE = 'data-design-title'

export interface DesignHtmlMetaInput {
  width?: number
  height?: number
  title?: string
}

const escapeAttr = (value: string): string => value.replace(/"/g, '&quot;')

/** 将元信息写进 `<html>` 根标签（覆盖同名 data-design-* 属性；无 `<html>` 开标签则补齐包裹） */
export const applyDesignHtmlMeta = (html: string, meta: DesignHtmlMetaInput): string => {
  const attrs: string[] = []
  if (meta.width != null) attrs.push(`${META_W}="${meta.width}"`)
  if (meta.height != null) attrs.push(`${META_H}="${meta.height}"`)
  if (meta.title != null) attrs.push(`${META_TITLE}="${escapeAttr(meta.title)}"`)
  if (!attrs.length) return html
  const attrText = attrs.join(' ')
  const tagMatch = /<html[^>]*>/i.exec(html)
  if (!tagMatch) {
    return `<!DOCTYPE html><html ${attrText}>${html}</html>`
  }
  const cleanedTag = tagMatch[0].replace(/\sdata-design-(w|h|title)="[^"]*"/gi, '').replace(/\s+>/, '>')
  // 字符串匹配整体字面替换（唯一标签），不进正则特殊字符
  return html.replace(tagMatch[0], cleanedTag.replace(/^<html/i, `<html ${attrText}`))
}

/** 从 `<html>` 根标签解析元信息（宽高齐全才视为合法设计稿文件） */
export const parseDesignHtmlMeta = (
  html: string
): { width: number; height: number; title?: string } | null => {
  const tag = /<html[^>]*>/i.exec(html)?.[0]
  if (!tag) return null
  const width = Number(new RegExp(`${META_W}="([^"]*)"`).exec(tag)?.[1])
  const height = Number(new RegExp(`${META_H}="([^"]*)"`).exec(tag)?.[1])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  const title = new RegExp(`${META_TITLE}="([^"]*)"`).exec(tag)?.[1]?.replace(/&quot;/g, '"')
  return { width: Math.round(width), height: Math.round(height), title: title || undefined }
}

/** 读取并解析设计稿文件；非本引擎产物（无元信息标记）或超限返回 null */
export const readDesignHtmlDoc = async (path: string): Promise<HtmlDesignDoc | null> => {
  if (!window.preload.fs.existsSync(path)) return null
  try {
    const html = await window.preload.fs.readTextFile(path)
    if (!html || html.length > HTML_DESIGN_MAX_LENGTH) return null
    const meta = parseDesignHtmlMeta(html)
    const version = parseDesignHtmlVersion(window.preload.path.basename(path))
    if (!meta || version === null) return null
    return {
      name: `html-${version}`,
      version,
      title: meta.title,
      width: meta.width,
      height: meta.height,
      html
    }
  } catch {
    return null
  }
}
