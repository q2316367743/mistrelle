import { ref } from 'vue'
import {
  HTML_DESIGN_MAX_LENGTH,
  applyDesignHtmlMeta,
  buildDesignHtmlFileName,
  buildDesignHtmlOutputsDir,
  parseDesignHtmlVersion,
  readDesignHtmlDoc,
  sanitizeDesignHtml,
  type DesignHtmlMetaInput,
  type HtmlDesignDoc,
  type HtmlDesignFileInfo
} from './designHtmlDoc'

/**
 * HTML 设计稿响应式 store（按 sandboxDir 键控的全局单例，镜像 CanvasStore）：
 * - 工具与侧边栏共享同一实例：AI 变更实时驱动预览
 * - html 为整串替换的源码（无节点级深变更），current 浅响应即可；每次写入即落盘
 */
export class DesignHtmlStore {
  /** 当前打开的设计稿（整串替换驱动预览重建） */
  readonly current = ref<HtmlDesignDoc | null>(null)
  /** outputs/ 下的设计稿文件列表 */
  readonly files = ref<HtmlDesignFileInfo[]>([])

  constructor(private readonly sandboxDir: string) {}

  /** 重新扫描 outputs/ 下的 html-{version}.html 列表（仅识别带元信息标记的设计稿） */
  async refreshFiles(): Promise<HtmlDesignFileInfo[]> {
    const dir = buildDesignHtmlOutputsDir(this.sandboxDir)
    if (!window.preload.fs.existsSync(dir)) {
      this.files.value = []
      return this.files.value
    }
    const items = await window.preload.fs.readDir(dir)
    const infos: HtmlDesignFileInfo[] = []
    for (const item of items) {
      if (!item.isFile) continue
      const version = parseDesignHtmlVersion(item.name)
      if (version === null) continue
      const doc = await readDesignHtmlDoc(item.path)
      if (!doc) continue
      infos.push({
        name: doc.name,
        version: doc.version,
        title: doc.title,
        path: item.path,
        updatedTime: item.mtime
      })
    }
    // 按版本升序，稳定的 t-select 展示顺序
    infos.sort((a, b) => a.version - b.version)
    this.files.value = infos
    return this.files.value
  }

  /** 打开指定版本设计稿为当前 */
  async open(version: number): Promise<HtmlDesignDoc | null> {
    const doc = await this.readDoc(version)
    this.current.value = doc
    if (doc) await this.refreshFiles()
    return doc
  }

  /** 读取指定版本源码原文（供 AI 分析，不改动当前设计稿） */
  async read(version: number): Promise<string | null> {
    const doc = await this.readDoc(version)
    return doc ? doc.html : null
  }

  /** 创建新设计稿（文件名取 html-{下一个版本号}）：清洗 → 注入元信息 → 落盘并设为当前 */
  async create(input: DesignHtmlMetaInput & { html: string }): Promise<HtmlDesignDoc> {
    const html = this.normalize(input.html)
    if (!html) throw new Error('html 内容为空或超过长度上限，请精简后重试')
    await this.refreshFiles()
    const nextVersion = this.files.value.length
      ? Math.max(...this.files.value.map((f) => f.version)) + 1
      : 1
    const width = Math.round(input.width ?? 800)
    const height = Math.round(input.height ?? 600)
    const doc: HtmlDesignDoc = {
      name: `html-${nextVersion}`,
      version: nextVersion,
      title: input.title,
      width: Math.max(1, width),
      height: Math.max(1, height),
      html: applyDesignHtmlMeta(html, { width: Math.max(1, width), height: Math.max(1, height), title: input.title })
    }
    await this.persistDoc(doc)
    this.current.value = doc
    await this.refreshFiles()
    return doc
  }

  /**
   * 整页替换当前设计稿源码（全量重写编辑模型）：清洗后落盘并驱动预览重建。
   * 可选携带 width / height 调整画布尺寸（缺省沿用当前尺寸）。
   */
  async write(html: string, size?: DesignHtmlMetaInput): Promise<HtmlDesignDoc> {
    const current = this.current.value
    if (!current) throw new Error('当前没有打开的设计稿，请先 html_create 或 html_open')
    const normalized = this.normalize(html)
    if (!normalized) throw new Error('html 内容为空或超过长度上限，请精简后重试')
    const width = Math.max(1, Math.round(size?.width ?? current.width))
    const height = Math.max(1, Math.round(size?.height ?? current.height))
    const doc: HtmlDesignDoc = {
      ...current,
      width,
      height,
      html: applyDesignHtmlMeta(normalized, { width, height })
    }
    await this.persistDoc(doc)
    this.current.value = doc
    return doc
  }

  /** 删除指定版本设计稿文件 */
  async delete(version: number): Promise<void> {
    const path = window.preload.path.join(
      buildDesignHtmlOutputsDir(this.sandboxDir),
      buildDesignHtmlFileName(version)
    )
    if (window.preload.fs.existsSync(path)) {
      await window.preload.fs.rm(path)
    }
    if (this.current.value?.version === version) this.current.value = null
    await this.refreshFiles()
  }

  /** 读取指定版本设计稿文档（不改动当前设计稿；导出指定版本用） */
  async readDoc(version: number): Promise<HtmlDesignDoc | null> {
    const path = window.preload.path.join(
      buildDesignHtmlOutputsDir(this.sandboxDir),
      buildDesignHtmlFileName(version)
    )
    return readDesignHtmlDoc(path)
  }

  /** 清洗 + 长度校验，返回空串表示非法输入 */
  private normalize(raw: string): string {
    const cleaned = sanitizeDesignHtml(String(raw ?? '')).trim()
    if (!cleaned || cleaned.length > HTML_DESIGN_MAX_LENGTH) return ''
    return cleaned
  }

  private async persistDoc(doc: HtmlDesignDoc): Promise<void> {
    const dir = buildDesignHtmlOutputsDir(this.sandboxDir)
    if (!window.preload.fs.existsSync(dir)) {
      await window.preload.fs.mkdir(dir, true)
    }
    const path = window.preload.path.join(dir, buildDesignHtmlFileName(doc.version))
    await window.preload.fs.writeTextFile(path, doc.html)
  }
}

const stores = new Map<string, DesignHtmlStore>()

/** 获取指定沙盒目录的设计稿 store（存在即复用，跨组件与工具共享同一响应式实例） */
export const getDesignHtmlStore = (sandboxDir: string): DesignHtmlStore => {
  let store = stores.get(sandboxDir)
  if (!store) {
    store = new DesignHtmlStore(sandboxDir)
    stores.set(sandboxDir, store)
  }
  return store
}

/** 销毁指定沙盒目录的设计稿 store（聊天删除时调用，释放内存） */
export const destroyDesignHtmlStore = (sandboxDir: string): void => {
  stores.delete(sandboxDir)
}
