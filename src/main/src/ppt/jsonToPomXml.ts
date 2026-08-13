/**
 * PptJsonDoc → POM XML 转换（主进程导出 / 渲染前调用，纯函数、不依赖 pom 库）：
 * - SlideNode 的 tag 即 XML 标签名，attr 即 XML 属性，child 为字符串时输出内联文本（Text 节点）
 * - child 为空数组 / 缺失时输出自闭合标签；渲染进程全程 JSON，只有这里涉及 xml
 * - SlideNode 顶层 id 是**纯 JSON 层标识**（不进 attr、不写进 XML）：只服务渲染进程的
 *   节点引用 / ppt_batch_edit，与 POM 布局、Arrow/Flow 的 attr.id 互不干扰（后者按 attr 原样透传）
 */
import type { PptJsonDoc, SlideNode } from '~/channels'

/** XML 属性值转义（& < > " 与 #xD） */
const escapeAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** XML 文本内容转义（& < >） */
const escapeText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * 规避 POM 布局 bug（10.3.0 实测）：**嵌套 HStack 链中的 Text 若未显式声明 w，
 * 布局测量得到 NaN 宽度 → buildPptx 抛 addTextBox: width must be a finite positive EMU value**。
 * 触发条件：Text 的祖先存在 ≥2 层且均无显式像素宽度的 HStack（胶囊标签 / 徽章 / 图标+文字组合常见）；
 * 显式声明 w（含 w="max"）走非测量路径即正常。这里自动给受影响 Text 补 attr.w = "max"（视觉等价，
 * 父级为 hug 时解析为内容宽），AI 无需感知。幂等：已声明 w 的 Text 不受影响。
 */
const normalizeHStackText = (node: SlideNode, hstackChain: number): void => {
  if (node.tag === 'HStack') {
    // 显式像素宽（纯数字）的 HStack 会断开测量链
    const hasPixelW = /^\d+(\.\d+)?$/.test(node.attr.w ?? '')
    const chain = hasPixelW ? 0 : hstackChain + 1
    if (Array.isArray(node.child)) node.child.forEach((child) => normalizeHStackText(child, chain))
    return
  }
  if (node.tag === 'Text' && node.attr.w === undefined && hstackChain >= 2) {
    node.attr.w = 'max'
  }
  if (Array.isArray(node.child))
    node.child.forEach((child) => normalizeHStackText(child, hstackChain))
}

/** 递归节点 → XML 片段（2 空格缩进；文本节点内联输出；attr 缺失按空处理） */
const nodeToXml = (node: SlideNode, depth: number): string => {
  const indent = '  '.repeat(depth)
  const attrs = Object.entries(node.attr ?? {})
    .map(([key, value]) => ` ${key}="${escapeAttr(value)}"`)
    .join('')
  if (typeof node.child === 'string') {
    return `${indent}<${node.tag}${attrs}>${escapeText(node.child)}</${node.tag}>`
  }
  if (Array.isArray(node.child) && node.child.length > 0) {
    const childrenXml = node.child.map((child) => nodeToXml(child, depth + 1)).join('\n')
    return `${indent}<${node.tag}${attrs}>\n${childrenXml}\n${indent}</${node.tag}>`
  }
  return `${indent}<${node.tag}${attrs} />`
}

/** theme 令牌表 → <Theme .../> 声明（无令牌返回空串） */
const buildThemeXml = (theme: Record<string, string>): string => {
  const attrs = Object.entries(theme)
    .map(([key, value]) => `${key}="${escapeAttr(value.replace(/^#/, ''))}"`)
    .join(' ')
  return attrs ? `<Theme ${attrs} />` : ''
}

/**
 * PptJsonDoc → POM XML（<Theme .../> + 多个 <Slide>，Slide 内为页根节点数组）。
 * 输入为 IPC 传输的副本，直接原地 normalize，不污染渲染进程的存储对象。
 */
export const jsonToPomXml = (doc: PptJsonDoc): string => {
  doc.slide.forEach((page) => page.forEach((node) => normalizeHStackText(node, 0)))
  const themeXml = buildThemeXml(doc.theme)
  const slidesXml = doc.slide
    .filter((page) => page.length > 0)
    .map((page) => `<Slide>\n${page.map((node) => nodeToXml(node, 1)).join('\n')}\n</Slide>`)
    .join('\n')
  return themeXml ? `${themeXml}\n${slidesXml}` : slidesXml
}
