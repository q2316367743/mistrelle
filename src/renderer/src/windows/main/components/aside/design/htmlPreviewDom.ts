import type { HtmlTreeNode } from '@/windows/main/components/design/htmlElementBridge'

/**
 * HTML 设计稿预览的 iframe DOM 工具（纯函数，从 HtmlDesignPreview 拆出守行数红线）。
 * 元素定位用「body 相对索引路径」（'0;1;2'，每段 = 元素在父级 Element 子节点中的下标），
 * 与构建树、双击取路径、滚轮升降级共用同一套解析，保证三处定位一致。
 */

/** iframe 文档内的选中标记属性：配合注入的 style 规则绘制蓝框 */
export const SEL_ATTR = 'data-dsel'

/** 元素在父级 Element 子节点中的下标（与 resolvePath 的索引语义对称） */
const elementIndexOf = (parent: Element, el: Element): number =>
  Array.from(parent.children).indexOf(el)

/** 元素的 body 相对路径；body 自身 / 不在 body 内（html/head）返回 null */
export const pathOfElement = (frameDoc: Document, el: Element): string | null => {
  const body = frameDoc.body
  if (!body || !body.contains(el) || el === body) return null
  const segs: number[] = []
  let cur: Element | null = el
  while (cur && cur !== body) {
    const parent = cur.parentElement
    if (!parent) return null
    segs.unshift(elementIndexOf(parent, cur))
    cur = parent
  }
  return segs.join(';')
}

/** 按 body 相对索引路径解析元素；路径为空或命中 body 本身返回 null（body 不可选中） */
export const resolvePath = (frameDoc: Document, path: string | undefined): Element | null => {
  const body = frameDoc.body
  if (!body || !path) return null
  let cur: Element = body
  for (const seg of path.split(';')) {
    const next = cur.children[Number(seg)]
    const view = cur.ownerDocument.defaultView
    if (!next || !view || !(next instanceof view.Element)) return null
    cur = next
  }
  return cur === body ? null : cur
}

// ─── 描述链 / 元素树构建 ──────────────────────────────────────

const describeOne = (el: Element): string => {
  const tag = el.tagName.toLowerCase()
  const id = el.id ? `#${el.id}` : ''
  const cls = (el.getAttribute('class') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((c) => `.${c}`)
    .join('')
  return `${tag}${id}${cls}`
}

const ownTextSnippet = (el: Element): string => {
  let text = ''
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? ''
  }
  text = text.replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return ` 「${text.slice(0, 20)}${text.length > 20 ? '…' : ''}」`
}

/** 完整描述链：body → 目标的各级特征 + 自身文本摘要（注入聊天 / AI 定位用） */
export const describeChain = (frameDoc: Document, el: Element): string => {
  const body = frameDoc.body
  const parts: string[] = []
  let cur: Element | null = el
  while (cur && cur !== body) {
    parts.unshift(describeOne(cur))
    cur = cur.parentElement
  }
  return `${parts.join(' > ')}${ownTextSnippet(el)}`
}

const TREE_MAX_NODES = 400
const TREE_MAX_DEPTH = 12

/** 从渲染后的 body 构建元素树（深度 / 总量设上限防超大文档卡顿） */
export const buildTree = (frameDoc: Document): HtmlTreeNode[] => {
  const body = frameDoc.body
  if (!body) return []
  let count = 0
  const walk = (parent: Element, depth: number, prefix: string): HtmlTreeNode[] => {
    if (depth > TREE_MAX_DEPTH || count >= TREE_MAX_NODES) return []
    const out: HtmlTreeNode[] = []
    Array.from(parent.children).forEach((child, index) => {
      if (count >= TREE_MAX_NODES) return
      count++
      const id = prefix ? `${prefix};${index}` : String(index)
      out.push({
        id,
        label: describeOne(child),
        chain: describeChain(frameDoc, child),
        children: walk(child, depth + 1, id)
      })
    })
    return out
  }
  return walk(body, 0, '')
}

// ─── 选中蓝框（data-dsel 标记 + 注入 style 规则，颜色取宿主 tdesign token） ──

/** 应用选中：清除旧标记后按路径标记新元素；路径解析失败返回 false（调用方取消选中） */
export const applySelection = (frameDoc: Document, path: string | undefined): boolean => {
  frameDoc.querySelectorAll(`[${SEL_ATTR}]`).forEach((el) => el.removeAttribute(SEL_ATTR))
  if (!path) return true
  const el = resolvePath(frameDoc, path)
  if (!el) return false
  el.setAttribute(SEL_ATTR, '')
  return true
}

/** 注入 / 更新选中样式规则（颜色运行时读宿主 token，导出走共用管线不带此样式） */
export const ensureSelectionStyle = (frameDoc: Document) => {
  const brand =
    getComputedStyle(document.documentElement).getPropertyValue('--td-brand-color').trim() ||
    '#0052d9'
  let style = frameDoc.getElementById('design-sel')
  if (!style) {
    style = frameDoc.createElement('style')
    style.id = 'design-sel'
    frameDoc.head.appendChild(style)
  }
  style.textContent = `[${SEL_ATTR}]{outline:2px solid ${brand} !important;outline-offset:-2px !important}`
}
