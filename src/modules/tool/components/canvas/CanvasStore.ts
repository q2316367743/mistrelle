import { nanoid } from 'nanoid'
import { requestDownload } from '@/plugin/http'
import { validateBatchOp, validateNode, validatePatch } from './canvasSchemas'
import type {
  CanvasBatchOp,
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

/** 仅识别 schema 2（图层树模型）；旧扁平 shapes 模型不兼容 */
const isSchema2 = (value: unknown): value is CanvasDoc =>
  typeof value === 'object' &&
  value !== null &&
  'schema' in value &&
  (value as { schema?: unknown }).schema === 2

const readDoc = async (path: string): Promise<CanvasDoc | null> => {
  if (!window.preload.fs.existsSync(path)) return null
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

const toFileInfo = (doc: CanvasDoc, path: string, mtime: number): CanvasFileInfo => ({
  name: doc.name,
  version: doc.version,
  title: doc.title,
  path,
  updatedTime: mtime
})

// ─── 节点树工具函数 ──────────────────────────────────────────

/** 为节点（含子树）统一生成新 id */
const assignIds = (node: CanvasNodeInput): CanvasNode => {
  const result: CanvasNode = { ...node, id: nanoid() }
  if (node.children?.length) result.children = node.children.map(assignIds)
  return result
}

/** 深拷贝节点并重新生成整棵子树 id */
const cloneWithNewIds = (node: CanvasNode): CanvasNode => {
  const result: CanvasNode = { ...node, id: nanoid() }
  if (node.children?.length) result.children = node.children.map(cloneWithNewIds)
  return result
}

/** 在树中按 id 查找节点，返回节点与其所属父数组 */
const findNodeInTree = (
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
const resolveParentList = (
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
const resolvePathNode = (
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
const normalizeStoredNodes = (nodes: CanvasNode[]): CanvasNode[] => {
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
const sanitizeNode = (raw: unknown): CanvasNodeInput => {
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
const sanitizePatch = (patch: Record<string, unknown> | undefined): Record<string, unknown> => {
  const errors = validatePatch(patch ?? {})
  if (errors.length) {
    throw new Error(`patch 参数非法：${errors.join('；')}`)
  }
  return patch ?? {}
}

/** G 操作：placeholder 渐变占位 / stock·ai 网络占位图（picsum 稳定种子，落盘沙盒） */
const applyImageOp = async (
  doc: CanvasDoc,
  sandboxDir: string,
  node: CanvasNode,
  kind: CanvasImageKind,
  prompt: string | undefined,
  issues: string[]
): Promise<unknown> => {
  if (kind === 'placeholder') {
    node.placeholderLabel = prompt || '图片'
    return { success: true, mode: 'placeholder', label: node.placeholderLabel }
  }
  const w = typeof node.width === 'number' ? Math.max(1, Math.round(node.width)) : 600
  const h = typeof node.height === 'number' ? Math.max(1, Math.round(node.height)) : 600
  const seed = encodeURIComponent(prompt || node.id || 'image')
  const url = `https://picsum.photos/seed/${seed}/${w}/${h}`
  try {
    const imagesDir = window.preload.path.join(buildCanvasOutputsDir(sandboxDir), 'images')
    const target = window.preload.path.join(imagesDir, `${node.id}.jpg`)
    await window.preload.fs.mkdir(imagesDir, true)
    await requestDownload({ url }, target)
    node.imageUrl = window.preload.net.pathToHref(target)
  } catch {
    node.imageUrl = url
    issues.push(`图片下载失败，已改用远程 URL：${url}`)
  }
  return { success: true, mode: kind, url: node.imageUrl }
}

// ─── Store ──────────────────────────────────────────────────

/**
 * 画布响应式 store（按 sandboxDir 键控的全局单例）：
 * - 工具与侧边栏共享同一实例：AI 变更实时驱动渲染
 * - 每次变更自动落盘到 outputs/canvas-{version}.canvas，重启聊天可恢复
 */
export class CanvasStore {
  /** 当前打开的画布（deep reactive，节点级变更驱动渲染层重建） */
  readonly current = ref<CanvasDoc | null>(null)
  /** outputs/ 下的画布文件列表 */
  readonly files = ref<CanvasFileInfo[]>([])

  constructor(private readonly sandboxDir: string) {}

  /** 重新扫描 outputs/ 下的 .canvas 文件列表（仅识别 schema 2） */
  async refreshFiles(): Promise<CanvasFileInfo[]> {
    const dir = buildCanvasOutputsDir(this.sandboxDir)
    if (!window.preload.fs.existsSync(dir)) {
      this.files.value = []
      return this.files.value
    }
    const items = await window.preload.fs.readDir(dir)
    const infos: CanvasFileInfo[] = []
    for (const item of items) {
      if (!item.isFile) continue
      const version = parseCanvasVersion(item.name)
      if (version === null) continue
      const doc = await readDoc(item.path)
      if (!doc) continue
      infos.push(toFileInfo(doc, item.path, item.mtime))
    }
    // 按版本升序，稳定的 t-select 展示顺序
    infos.sort((a, b) => a.version - b.version)
    this.files.value = infos
    return this.files.value
  }

  /** 打开指定版本画布为当前画布 */
  async open(version: number): Promise<CanvasDoc | null> {
    const path = window.preload.path.join(buildCanvasOutputsDir(this.sandboxDir), buildCanvasFileName(version))
    const doc = await readDoc(path)
    this.current.value = doc
    if (doc) await this.refreshFiles()
    return doc
  }

  /** 读取指定版本画布的原始 JSON 文本（供 AI 分析，不改动当前画布；返回前治愈缺失 type） */
  async read(version: number): Promise<string | null> {
    const path = window.preload.path.join(buildCanvasOutputsDir(this.sandboxDir), buildCanvasFileName(version))
    if (!window.preload.fs.existsSync(path)) return null
    const parsed = JSON.parse(await window.preload.fs.readTextFile(path)) as unknown
    if (!isSchema2(parsed)) return null
    const doc = parsed as CanvasDoc
    if (Array.isArray(doc.nodes)) normalizeStoredNodes(doc.nodes)
    return JSON.stringify(doc)
  }

  /**
   * 创建新画布（schema 2 图层树模型）：文件名取 canvas-{下一个版本号}。
   * 创建后自动设为当前画布并落盘。
   */
  async create(input: {
    title?: string
    width: number
    height: number
    background?: string
    palette?: Record<string, string>
  }): Promise<CanvasDoc> {
    await this.refreshFiles()
    const nextVersion = this.files.value.length
      ? Math.max(...this.files.value.map((f) => f.version)) + 1
      : 1
    const name = `canvas-${nextVersion}`
    const doc: CanvasDoc = {
      name,
      version: nextVersion,
      title: input.title,
      schema: 2,
      width: input.width,
      height: input.height,
      background: input.background ?? '#ffffff',
      nodes: [],
      palette: input.palette ?? {}
    }
    await this.persistDoc(doc)
    this.current.value = doc
    await this.refreshFiles()
    return doc
  }

  /** 删除指定版本画布文件 */
  async delete(version: number): Promise<void> {
    const path = window.preload.path.join(buildCanvasOutputsDir(this.sandboxDir), buildCanvasFileName(version))
    if (window.preload.fs.existsSync(path)) {
      await window.preload.fs.rm(path)
    }
    if (this.current.value?.version === version) this.current.value = null
    await this.refreshFiles()
  }

  /** 将当前画布落盘 */
  async save(): Promise<CanvasDoc> {
    const doc = this.current.value
    if (!doc) throw new Error('当前没有打开的画布，请先 canvas_create 或 canvas_open')
    await this.persistDoc(doc)
    return doc
  }

  /** 定义 / 合并调色板（name → 颜色），返回全量调色板 */
  async setPalette(palette: Record<string, string>): Promise<Record<string, string>> {
    const doc = this.current.value
    if (!doc) throw new Error('当前没有打开的画布，请先 canvas_create 或 canvas_open')
    doc.palette = { ...(doc.palette ?? {}), ...palette }
    await this.persist()
    return doc.palette
  }

  /** 当前画布根图层（含 id，供 update / move 前查看） */
  getNodes(): CanvasNode[] {
    return this.current.value?.nodes ?? []
  }

  /**
   * 批量编辑（对齐 ardot batch_edit）：顺序执行 I/C/U/M/D/G。
   * 单点容错：每个 op 先经 TypeBox 校验、再执行；任一 op 校验或执行失败只让该 op
   * 返回 { error }（results 内联），其余 op 照常执行并落盘 —— 一个坏节点不拖垮整批。
   * 级联语义：被跳过的 op 不写入 as 绑定，后续引用它的 op 会因找不到绑定而独立报错。
   */
  async batchEdit(ops: CanvasBatchOp[]): Promise<{ results: unknown[]; potentialIssues: string[] }> {
    const doc = this.current.value
    if (!doc) throw new Error('当前没有打开的画布，请先 canvas_create 或 canvas_open')
    const results: unknown[] = []
    const issues: string[] = []
    const bindings = new Map<string, string>()
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i]
      try {
        const opErrors = validateBatchOp(op)
        if (opErrors.length) throw new Error(opErrors.join('；'))
        results.push(this.executeOp(doc, op, bindings, issues))
      } catch (err) {
        results.push({ error: `第 ${i + 1} 个操作失败：${err instanceof Error ? err.message : String(err)}` })
      }
    }
    await this.persist()
    return { results, potentialIssues: issues }
  }

  private executeOp(
    doc: CanvasDoc,
    op: CanvasBatchOp,
    bindings: Map<string, string>,
    issues: string[]
  ): unknown {
    switch (op.op) {
      case 'insert': {
        const parent = resolveParentList(doc, op.parent, bindings)
        const node = assignIds(sanitizeNode(op.node))
        if (!node.name) issues.push('insert 的节点缺少 name，建议赋予有意义的图层名')
        parent.push(node)
        if (op.as) bindings.set(op.as, node.id)
        return node
      }
      case 'copy': {
        const source = findNodeInTree(doc.nodes, op.id)
        if (!source) throw new Error(`未找到被复制节点 ${op.id}`)
        const clone = cloneWithNewIds(source.node)
        if (op.overrides) Object.assign(clone, sanitizePatch(op.overrides))
        const parent = resolveParentList(doc, op.parent, bindings)
        parent.push(clone)
        if (op.as) bindings.set(op.as, clone.id)
        return clone
      }
      case 'update': {
        const target = resolvePathNode(doc, op.path, bindings)
        if (!target) throw new Error(`未找到更新目标 ${op.path}`)
        Object.assign(target, sanitizePatch(op.patch))
        return target
      }
      case 'move': {
        const found = findNodeInTree(doc.nodes, op.id)
        if (!found) throw new Error(`未找到节点 ${op.id}`)
        const { node, parent } = found
        // 先解析目标父列表（可能抛错），再移除/插入，避免解析失败残留已删节点
        const target = op.parent != null ? resolveParentList(doc, op.parent, bindings) : parent
        const index = op.index ?? target.length
        parent.splice(parent.indexOf(node), 1)
        target.splice(Math.max(0, Math.min(index, target.length)), 0, node)
        return node
      }
      case 'delete': {
        const found = findNodeInTree(doc.nodes, op.id)
        if (!found) throw new Error(`未找到节点 ${op.id}`)
        found.parent.splice(found.parent.indexOf(found.node), 1)
        return { success: true }
      }
      case 'image': {
        const found = findNodeInTree(doc.nodes, op.id)
        if (!found) throw new Error(`未找到节点 ${op.id}`)
        return applyImageOp(doc, this.sandboxDir, found.node, op.kind, op.prompt, issues)
      }
      default:
        throw new Error(`未知操作类型`)
    }
  }

  private async persist(): Promise<void> {
    const doc = this.current.value
    if (!doc) return
    await this.persistDoc(doc)
  }

  private async persistDoc(doc: CanvasDoc): Promise<void> {
    const dir = buildCanvasOutputsDir(this.sandboxDir)
    if (!window.preload.fs.existsSync(dir)) {
      await window.preload.fs.mkdir(dir, true)
    }
    const path = window.preload.path.join(dir, buildCanvasFileName(doc.version))
    await window.preload.fs.writeTextFile(path, JSON.stringify(doc))
  }
}

const stores = new Map<string, CanvasStore>()

/** 获取指定沙盒目录的画布 store（存在即复用，跨组件与工具共享同一响应式实例） */
export const getCanvasStore = (sandboxDir: string): CanvasStore => {
  let store = stores.get(sandboxDir)
  if (!store) {
    store = new CanvasStore(sandboxDir)
    stores.set(sandboxDir, store)
  }
  return store
}

/** 销毁指定沙盒目录的画布 store（聊天删除时调用，释放内存） */
export const destroyCanvasStore = (sandboxDir: string): void => {
  stores.delete(sandboxDir)
}
