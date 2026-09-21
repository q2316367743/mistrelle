import { nanoid } from 'nanoid'
import { requestDownload } from '@/plugin/http'
import { readImageInfo } from '@/utils/imageInfo'
import { validateNode, validatePatch } from './canvasSchemas'
import type {
  CanvasDoc,
  CanvasFileInfo,
  CanvasImageKind,
  CanvasNode,
  CanvasNodeInput
} from './canvasTypes'

/** 画布文件名固定前缀：outputs/canvas-{version}.canvas，自定义后缀便于筛选与渲染 */
const CANVAS_FILE_PREFIX = 'canvas-'
const CANVAS_FILE_EXT = '.canvas'

const canvasFileRegex = /^canvas-(\d+)\.canvas$/

/** 解析文件名版本号，非画布文件返回 null */
export const parseCanvasVersion = (name: string): number | null => {
  const match = canvasFileRegex.exec(name)
  return match ? Number(match[1]) : null
}

export const buildCanvasFileName = (version: number): string =>
  `${CANVAS_FILE_PREFIX}${version}${CANVAS_FILE_EXT}`

/** 输出目录：~/.mistrelle/workspace/{chatId}/outputs */
export const buildCanvasOutputsDir = (sandboxDir: string): string =>
  window.preload.path.join(sandboxDir, 'outputs')

/** 归档目录：outputs/archived（归档画布整体移入，AI 工具列表不再可见） */
export const buildCanvasArchivedDir = (sandboxDir: string): string =>
  window.preload.path.join(buildCanvasOutputsDir(sandboxDir), 'archived')

/** 仅识别 schema 2（图层树模型）；旧扁平 shapes 模型不兼容 */
export const isSchema2 = (value: unknown): value is CanvasDoc =>
  typeof value === 'object' &&
  value !== null &&
  'schema' in value &&
  (value as { schema?: unknown }).schema === 2

export const readDoc = async (path: string): Promise<CanvasDoc | null> => {
  if (!(window.preload.fs.existsSync(path))) return null
  try {
    const parsed = JSON.parse(await window.preload.fs.readTextFile(path)) as unknown
    if (!isSchema2(parsed)) return null
    const doc = parsed as CanvasDoc
    if (Array.isArray(doc.nodes)) normalizeStoredNodes(doc.nodes)
    return doc
  } catch {
    return null
  }
}

export const toFileInfo = (doc: CanvasDoc, path: string, mtime: number): CanvasFileInfo => ({
  name: doc.name,
  version: doc.version,
  title: doc.title,
  path,
  updatedTime: mtime,
  source: doc.source
})

// ─── 节点树工具函数 ──────────────────────────────────────────

/** 为节点（含子树）统一生成新 id */
export const assignIds = (node: CanvasNodeInput): CanvasNode => {
  const result: CanvasNode = { ...node, id: nanoid() }
  if (node.children?.length) result.children = node.children.map(assignIds)
  return result
}

/** 深拷贝节点并重新生成整棵子树 id */
export const cloneWithNewIds = (node: CanvasNode): CanvasNode => {
  const result: CanvasNode = { ...node, id: nanoid() }
  if (node.children?.length) result.children = node.children.map(cloneWithNewIds)
  return result
}

/** 在树中按 id 查找节点，返回节点与其所属父数组 */
export const findNodeInTree = (
  nodes: CanvasNode[],
  id: string
): { node: CanvasNode; parent: CanvasNode[] } | null => {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) return { node: nodes[i], parent: nodes }
    const children = nodes[i].children
    if (children?.length) {
      const found = findNodeInTree(children, id)
      if (found) return found
    }
  }
  return null
}

/** 解析父引用：'root' → 根图层；'@绑定名' → 绑定 id；其余按节点 id */
export const resolveParentList = (
  doc: CanvasDoc,
  ref: string,
  bindings: Map<string, string>
): CanvasNode[] => {
  if (ref === 'root') return doc.nodes
  let id = ref
  if (ref.startsWith('@')) {
    const bound = bindings.get(ref.slice(1))
    if (!bound) throw new Error(`未找到绑定名 ${ref}，请先在 insert/copy 中声明 as`)
    id = bound
  }
  const found = findNodeInTree(doc.nodes, id)
  if (!found) throw new Error(`未找到父节点 id ${id}`)
  if (found.node.type !== 'group') throw new Error(`父节点 ${id} 类型不是 group，不能挂子节点`)
  if (!found.node.children) found.node.children = []
  return found.node.children
}

/** 解析节点路径：'id' | '父id;子id'（可多层）| '@绑定;子id' */
export const resolvePathNode = (
  doc: CanvasDoc,
  path: string,
  bindings: Map<string, string>
): CanvasNode | null => {
  const segments = path.split(';')
  const first = segments[0]
  let id = first
  if (first.startsWith('@')) {
    const bound = bindings.get(first.slice(1))
    if (!bound) return null
    id = bound
  }
  let current = findNodeInTree(doc.nodes, id)?.node ?? null
  if (!current) return null
  for (let i = 1; i < segments.length; i++) {
    current = current.children?.find((c) => c.id === segments[i]) ?? null
    if (!current) return null
  }
  return current
}

// ─── 内联 SVG 的调色板 token 替换 ──────────────────────────

/** 匹配 svg 字符串中的 $token名（字母 / 数字 / 下划线 / 连字符 / 中文） */
const SVG_TOKEN_RE = /\$([a-zA-Z0-9_\-\u4e00-\u9fa5]+)/g

/** 将 svg 字符串中的 $token名 替换为调色板实色；未命中的 token 原样保留 */
const resolveSvgTokenString = (svg: string, palette: Record<string, string>): string => {
  if (!svg.includes('$')) return svg
  return svg.replace(SVG_TOKEN_RE, (match, token: string) => {
    const color = palette[token]
    return color != null ? color : match
  })
}

/** 递归替换节点（含子树）内联 svg 中的调色板 token，使 svg 图标能跟随 $token 配色 */
export const resolveSvgTokens = (node: CanvasNode, palette: Record<string, string>): void => {
  if (typeof node.svg === 'string') node.svg = resolveSvgTokenString(node.svg, palette)
  node.children?.forEach((child) => resolveSvgTokens(child, palette))
}

// ─── 输入校验：TypeBox 单一源（canvasSchemas.ts），非法即抛错反馈模型自纠 ──────────

const CANVAS_NODE_TYPES = new Set<string>([
  'group',
  'text',
  'rect',
  'ellipse',
  'line',
  'polygon',
  'star',
  'path',
  'image',
  'svg'
])

/** 按字段推断缺失的节点类型（AI 常省略 type，靠字段结构判断） */
const inferNodeType = (input: Record<string, unknown>): string | undefined => {
  if (typeof input.svg === 'string') return 'svg'
  if (typeof input.imageUrl === 'string') return 'image'
  if (typeof input.path === 'string') return 'path'
  if (typeof input.text === 'string' || input.fontSize != null || input.fontFamily != null) return 'text'
  if (input.sides != null) return 'polygon'
  if (input.corners != null || input.innerRadius != null) return 'star'
  if (Array.isArray(input.points)) return 'line'
  if (Array.isArray(input.children)) return 'group'
  return 'rect'
}

/**
 * 治愈存量脏数据：为缺失 / 非法 type 的节点补上推断的类型（仅写 type，不改其余）。
 * 用于读取已落盘画布时，让早期（无清洗）生成的画布也能正常渲染。
 */
export const normalizeStoredNodes = (nodes: CanvasNode[]): CanvasNode[] => {
  for (const node of nodes) {
    if (typeof node.type !== 'string' || !CANVAS_NODE_TYPES.has(node.type)) {
      const inferred = inferNodeType(node as unknown as Record<string, unknown>)
      if (inferred && CANVAS_NODE_TYPES.has(inferred)) {
        ;(node as unknown as Record<string, unknown>).type = inferred
      }
    }
    if (Array.isArray(node.children)) normalizeStoredNodes(node.children)
  }
  return nodes
}

/**
 * 校验节点（含递归 children）：type 缺失时按字段推断补全；
 * 其余字段经 TypeBox schema（canvasSchemas.ts）严格校验，非法即抛错（不再静默丢弃）。
 */
export const sanitizeNode = (raw: unknown): CanvasNodeInput => {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  let type = input.type
  // type 缺失 / 未知 → 按字段推断（保留文档所述推断能力；ardot 别名不再归一化，非法直接报错）
  if (!(typeof type === 'string' && CANVAS_NODE_TYPES.has(type))) {
    type = inferNodeType(input)
  }
  if (typeof type !== 'string' || !CANVAS_NODE_TYPES.has(type)) {
    throw new Error(
      `未知节点类型 ${String(type)}，可用：group / text / rect / ellipse / line / polygon / star / path / image / svg`
    )
  }
  const node: Record<string, unknown> = { ...input, type }
  if (Array.isArray(node.children)) {
    // children 尚未生成 id（由 assignIds 统一补齐），此处先按无 id 校验
    node.children = node.children.map(sanitizeNode)
  }
  const errors = validateNode(node)
  if (errors.length) {
    throw new Error(`节点参数非法：${errors.join('；')}`)
  }
  return node as unknown as CanvasNodeInput
}

/** 校验 update patch / copy overrides：禁改 id/type/children，非法即抛错（不再静默忽略） */
export const sanitizePatch = (patch: Record<string, unknown> | undefined): Record<string, unknown> => {
  const errors = validatePatch(patch ?? {})
  if (errors.length) {
    throw new Error(`patch 参数非法：${errors.join('；')}`)
  }
  return patch ?? {}
}

/** 解析图片 URL 的扩展名（决定 web 落盘文件后缀），未知一律用 png */
const resolveWebImageExt = (url: string): string => {
  try {
    const ext = new URL(url).pathname.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase()
    return ext && ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif', 'ico'].includes(ext) ? ext : 'png'
  } catch {
    return 'png'
  }
}

/** G 操作：placeholder 渐变占位 / stock·ai 网络占位图（picsum 稳定种子，落盘沙盒）/ web 真实图片（落盘沙盒）/ local 本地图片（引用绝对路径） */
export const applyImageOp = async (
  _doc: CanvasDoc,
  sandboxDir: string,
  node: CanvasNode,
  kind: CanvasImageKind,
  prompt: string | undefined,
  url?: string
): Promise<unknown> => {
  if (kind === 'placeholder') {
    node.placeholderLabel = prompt || '图片'
    return { success: true, mode: 'placeholder', label: node.placeholderLabel }
  }
  if (kind === 'web') {
    if (!url) return { error: 'web 类型缺少 url：请提供真实图片地址（http/https）' }
    const ext = resolveWebImageExt(url)
    const imagesDir = window.preload.path.join(buildCanvasOutputsDir(sandboxDir), 'images')
    const target = window.preload.path.join(imagesDir, `${node.id}.${ext}`)
    try {
      await window.preload.fs.mkdir(imagesDir, true)
      await requestDownload({ url }, target)
      node.imageUrl = target
    } catch {
      return { error: `图片下载失败：${url}（画布无法渲染非同源远程图片，请提供可下载的素材）` }
    }
    const info = await readImageInfo(target)
    return {
      success: true,
      mode: 'web',
      url: node.imageUrl,
      ...(info ? { format: info.format, width: info.width, height: info.height } : {})
    }
  }
  if (kind === 'local') {
    if (!url) return { error: 'local 类型缺少 url：请提供本地图片绝对路径' }
    node.imageUrl = url
    const info = await readImageInfo(url)
    return {
      success: true,
      mode: 'local',
      url: node.imageUrl,
      ...(info ? { format: info.format, width: info.width, height: info.height } : {})
    }
  }
  const w = typeof node.width === 'number' ? Math.max(1, Math.round(node.width)) : 600
  const h = typeof node.height === 'number' ? Math.max(1, Math.round(node.height)) : 600
  const seed = encodeURIComponent(prompt || node.id || 'image')
  const picsumUrl = `https://picsum.photos/seed/${seed}/${w}/${h}`
  const target = window.preload.path.join(buildCanvasOutputsDir(sandboxDir), 'images', `${node.id}.jpg`)
  try {
    await window.preload.fs.mkdir(window.preload.path.dirname(target), true)
    await requestDownload({ url: picsumUrl }, target)
    node.imageUrl = target
  } catch {
    return { error: `网络占位图下载失败：${picsumUrl}` }
  }
  const info = await readImageInfo(target)
  return {
    success: true,
    mode: kind,
    url: node.imageUrl,
    ...(info ? { format: info.format, width: info.width, height: info.height } : {})
  }
}
