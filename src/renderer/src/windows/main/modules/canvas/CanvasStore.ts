import { validateBatchOp } from './canvasSchemas'
import type { CanvasBatchOp, CanvasDoc, CanvasDocSource, CanvasFileInfo, CanvasNode } from './canvasTypes'
import { removeUploadSourceFiles } from './canvasUploads'
import {
  applyImageOp,
  assignIds,
  buildCanvasArchivedDir,
  buildCanvasFileName,
  buildCanvasOutputsDir,
  cloneWithNewIds,
  findNodeInTree,
  isSchema2,
  normalizeStoredNodes,
  parseCanvasVersion,
  readDoc,
  resolveParentList,
  resolvePathNode,
  resolveSvgTokens,
  sanitizeNode,
  sanitizePatch,
  toFileInfo
} from './canvasDocOps'

/** 扫描目录下的 .canvas 文件（仅识别 schema 2），按版本升序 */
const scanCanvasFiles = async (dir: string): Promise<CanvasFileInfo[]> => {
  if (!(window.preload.fs.existsSync(dir))) return []
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
  infos.sort((a, b) => a.version - b.version)
  return infos
}

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
  /** outputs/archived/ 下的归档画布列表（AI 工具不可见，仅侧边栏管理） */
  readonly archivedFiles = ref<CanvasFileInfo[]>([])

  constructor(private readonly sandboxDir: string) {}

  /**
   * 重新扫描画布文件列表（仅识别 schema 2）：
   * outputs/ 根目录为活跃画布，outputs/archived/ 为归档画布。
   * 返回值仍为活跃列表（AI 工具消费方零改动，归档画布自然不可见）。
   */
  async refreshFiles(): Promise<CanvasFileInfo[]> {
    this.files.value = await scanCanvasFiles(buildCanvasOutputsDir(this.sandboxDir))
    this.archivedFiles.value = await scanCanvasFiles(buildCanvasArchivedDir(this.sandboxDir))
    return this.files.value
  }

  /** 打开指定版本画布为当前画布 */
  async open(version: number): Promise<CanvasDoc | null> {
    const path = window.preload.path.join(buildCanvasOutputsDir(this.sandboxDir), buildCanvasFileName(version))
    const doc = await readDoc(path)
    this.current.value = doc
    if (doc) await this.refreshFiles()
    // 返回响应式代理而非原始对象：调用方就地变更才能触发渲染层
    return this.current.value
  }

  /** 读取指定版本画布的原始 JSON 文本（供 AI 分析，不改动当前画布；返回前治愈缺失 type） */
  async read(version: number): Promise<string | null> {
    const path = window.preload.path.join(buildCanvasOutputsDir(this.sandboxDir), buildCanvasFileName(version))
    if (!(window.preload.fs.existsSync(path))) return null
    const parsed = JSON.parse(await window.preload.fs.readTextFile(path)) as unknown
    if (!isSchema2(parsed)) return null
    const doc = parsed as CanvasDoc
    if (Array.isArray(doc.nodes)) normalizeStoredNodes(doc.nodes)
    return JSON.stringify(doc)
  }

  /**
   * 创建新画布（schema 2 图层树模型）：文件名取 canvas-{下一个版本号}。
   * 版本号在「活跃 ∪ 归档」全量上取 max+1，避免归档版本号被复用导致归档时互相覆盖。
   * 创建后自动设为当前画布并落盘。
   */
  async create(input: {
    title?: string
    width: number
    height: number
    background?: string
    palette?: Record<string, string>
    /** 产物来源标记（upload = 上传图片生成的画布） */
    source?: CanvasDocSource
  }): Promise<CanvasDoc> {
    await this.refreshFiles()
    const nextVersion =
      Math.max(0, ...this.files.value.map((f) => f.version), ...this.archivedFiles.value.map((f) => f.version)) + 1
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
      palette: input.palette ?? {},
      source: input.source
    }
    await this.persistDoc(doc)
    this.current.value = doc
    await this.refreshFiles()
    // 返回响应式代理而非原始对象：调用方就地变更（如上传画布 push 图片节点）才能触发渲染层
    return this.current.value
  }

  /** 删除指定版本画布文件（source=upload 的画布连带删除其引用的 uploads/ 源图片） */
  async delete(version: number): Promise<void> {
    const path = window.preload.path.join(buildCanvasOutputsDir(this.sandboxDir), buildCanvasFileName(version))
    const doc = await readDoc(path)
    if (window.preload.fs.existsSync(path)) {
      await window.preload.fs.rm(path)
    }
    if (doc?.source === 'upload') await removeUploadSourceFiles(this.sandboxDir, doc)
    if (this.current.value?.version === version) this.current.value = null
    await this.refreshFiles()
  }

  /**
   * 归档指定版本画布：移入 outputs/archived/（AI 工具列表随之不可见）。
   * 若为当前打开的画布则同时关闭——persistDoc 恒写根目录路径，
   * 不关闭会导致编辑已归档画布时在根目录复活出重复文件。
   */
  async archive(version: number): Promise<void> {
    const from = window.preload.path.join(buildCanvasOutputsDir(this.sandboxDir), buildCanvasFileName(version))
    if (!(window.preload.fs.existsSync(from))) return
    const archivedDir = buildCanvasArchivedDir(this.sandboxDir)
    if (!(window.preload.fs.existsSync(archivedDir))) {
      await window.preload.fs.mkdir(archivedDir, true)
    }
    await window.preload.fs.rename(from, window.preload.path.join(archivedDir, buildCanvasFileName(version)))
    if (this.current.value?.version === version) this.current.value = null
    await this.refreshFiles()
  }

  /** 取消归档：移回 outputs/ 根目录（打开归档画布前须先取消归档，保证写入路径唯一） */
  async unarchive(version: number): Promise<void> {
    const from = window.preload.path.join(buildCanvasArchivedDir(this.sandboxDir), buildCanvasFileName(version))
    if (!(window.preload.fs.existsSync(from))) return
    await window.preload.fs.rename(from, window.preload.path.join(buildCanvasOutputsDir(this.sandboxDir), buildCanvasFileName(version)))
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
        resolveSvgTokens(node, doc.palette ?? {})
        parent.push(node)
        if (op.as) bindings.set(op.as, node.id)
        return node
      }
      case 'copy': {
        const source = findNodeInTree(doc.nodes, op.id)
        if (!source) throw new Error(`未找到被复制节点 ${op.id}`)
        const clone = cloneWithNewIds(source.node)
        if (op.overrides) Object.assign(clone, sanitizePatch(op.overrides))
        resolveSvgTokens(clone, doc.palette ?? {})
        const parent = resolveParentList(doc, op.parent, bindings)
        parent.push(clone)
        if (op.as) bindings.set(op.as, clone.id)
        return clone
      }
      case 'update': {
        const target = resolvePathNode(doc, op.path, bindings)
        if (!target) throw new Error(`未找到更新目标 ${op.path}`)
        Object.assign(target, sanitizePatch(op.patch))
        resolveSvgTokens(target, doc.palette ?? {})
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
        return applyImageOp(doc, this.sandboxDir, found.node, op.kind, op.prompt, op.url)
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
    if (!(window.preload.fs.existsSync(dir))) {
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
