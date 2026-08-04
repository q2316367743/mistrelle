import { nanoid } from 'nanoid'
import type {
  CanvasDoc,
  CanvasFileInfo,
  CanvasShape,
  CanvasShapeInput,
  CanvasShapeType
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

const readDoc = async (path: string): Promise<CanvasDoc | null> => {
  if (!window.preload.fs.existsSync(path)) return null
  try {
    const doc = JSON.parse(await window.preload.fs.readTextFile(path)) as CanvasDoc
    return doc && typeof doc === 'object' ? doc : null
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

/**
 * 画布响应式 store（按 sandboxDir 键控的全局单例，仿 getChatSession 模式）：
 * - 工具与侧边栏共享同一实例：AI 变更实时驱动渲染
 * - 每次变更自动落盘到 outputs/canvas-{version}.canvas，重启聊天可恢复
 */
export class CanvasStore {
  /** 当前打开的画布（deep reactive，shape 级变更驱动渲染层重建） */
  readonly current = ref<CanvasDoc | null>(null)
  /** outputs/ 下的画布文件列表 */
  readonly files = ref<CanvasFileInfo[]>([])

  constructor(private readonly sandboxDir: string) {}

  /** 重新扫描 outputs/ 下的 .canvas 文件列表 */
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

  /** 读取指定版本画布的原始 JSON 文本（供 AI 分析，不改动当前画布） */
  async read(version: number): Promise<string | null> {
    const path = window.preload.path.join(buildCanvasOutputsDir(this.sandboxDir), buildCanvasFileName(version))
    if (!window.preload.fs.existsSync(path)) return null
    return window.preload.fs.readTextFile(path)
  }

  /**
   * 创建新画布：文件名取 canvas-{下一个版本号}，避免覆盖已有画布。
   * 创建后自动设为当前画布并落盘。
   */
  async create(input: { title?: string; width: number; height: number; background?: string }): Promise<CanvasDoc> {
    await this.refreshFiles()
    const nextVersion = this.files.value.length
      ? Math.max(...this.files.value.map((f) => f.version)) + 1
      : 1
    const name = `canvas-${nextVersion}`
    const doc: CanvasDoc = {
      name,
      version: nextVersion,
      title: input.title,
      width: input.width,
      height: input.height,
      background: input.background ?? '#ffffff',
      shapes: []
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

  /** 新增一个图形到当前画布并自动保存 */
  async addShape(type: CanvasShapeType, input: CanvasShapeInput): Promise<CanvasShape> {
    const doc = this.current.value
    if (!doc) throw new Error('当前没有打开的画布，请先 canvas_create 或 canvas_open')
    const shape: CanvasShape = { id: nanoid(), type, ...input }
    doc.shapes.push(shape)
    await this.persist()
    return shape
  }

  /** 按 id 更新当前画布中的图形并自动保存 */
  async updateShape(id: string, patch: Partial<CanvasShapeInput>): Promise<CanvasShape | null> {
    const doc = this.current.value
    if (!doc) throw new Error('当前没有打开的画布，请先 canvas_create 或 canvas_open')
    const shape = doc.shapes.find((s) => s.id === id)
    if (!shape) return null
    Object.assign(shape, patch)
    await this.persist()
    return shape
  }

  /** 按 id 平移当前画布中的图形（相对位移） */
  async moveShape(id: string, delta: { dx: number; dy: number }): Promise<CanvasShape | null> {
    const doc = this.current.value
    if (!doc) throw new Error('当前没有打开的画布，请先 canvas_create 或 canvas_open')
    const shape = doc.shapes.find((s) => s.id === id)
    if (!shape) return null
    shape.x += delta.dx
    shape.y += delta.dy
    await this.persist()
    return shape
  }

  /** 按 id 移除当前画布中的图形并自动保存 */
  async removeShape(id: string): Promise<boolean> {
    const doc = this.current.value
    if (!doc) throw new Error('当前没有打开的画布，请先 canvas_create 或 canvas_open')
    const index = doc.shapes.findIndex((s) => s.id === id)
    if (index < 0) return false
    doc.shapes.splice(index, 1)
    await this.persist()
    return true
  }

  /** 当前画布全部图形（含 id，供 update / move 前查看） */
  getShapes(): CanvasShape[] {
    return this.current.value?.shapes ?? []
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
