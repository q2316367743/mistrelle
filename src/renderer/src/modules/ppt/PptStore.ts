/**
 * PPT 响应式 store（按 sandboxDir 键控的全局单例，同 CanvasStore 模式）：
 * - 工具与侧边栏共享同一实例：AI 变更（写 outputs/slides-{version}.pom.xml）实时驱动渲染
 * - watch(current.xml) → 500ms 防抖 → 主进程渲染每页 SVG；失败保留旧图并记录错误
 * - batchEdit 基于 POM 的 parseXml / serializeXml（clientApi，环境无关），
 *   同批校验、任一失败整体回滚（校验失败不落盘即回滚）
 */
import { ref, watch } from 'vue'
import { parseXml, serializeXml } from '@hirokisakabe/pom/clientApi'
import type { POMNode } from '@hirokisakabe/pom/clientApi'
import { renderPptxToSvgs } from './pptRender'
import type { PptBatchOp, PptCurrentDoc, PptFileInfo, PptRenderState } from './pptTypes'
import { PPT_SLIDE_SIZE } from './pptTypes'

const SLIDES_FILE_REGEX = /^slides-(\d+)\.pom\.xml$/

/** 解析版本文件名版本号，非 PPT 文件返回 null */
export const parseSlidesVersion = (name: string): number | null => {
  const match = SLIDES_FILE_REGEX.exec(name)
  return match ? Number(match[1]) : null
}

export const buildSlidesFileName = (version: number): string => `slides-${version}.pom.xml`

/** 输出目录：~/.mistrelle/workspace/{chatId}/outputs */
export const buildPptOutputsDir = (sandboxDir: string): string =>
  window.preload.path.join(sandboxDir, 'outputs')

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/** ppt_create 初始骨架：16:9 标题页（AI 后续经 batch_edit 续写内容页） */
const buildCreateXml = (title: string): string => `<Slide>
  <VStack w="100%" h="100%" padding="48" gap="24" alignItems="center" justifyContent="center" backgroundColor="F8F9FA">
    <Text fontSize="48" bold="true" color="1F2937" text="${title}" />
    <Text fontSize="24" color="6B7280" text="副标题或说明文字" />
  </VStack>
</Slide>`

/** 下一个版本号（当前最大版本 + 1） */
const nextVersionOf = (files: PptFileInfo[]): number =>
  files.length ? Math.max(...files.map((f) => f.version)) + 1 : 1

export class PptStore {
  /** outputs/ 下的版本文件列表 */
  readonly files = ref<PptFileInfo[]>([])
  /** 当前打开的文档（AI / 侧边栏共享，xml 变更驱动自动渲染） */
  readonly current = ref<PptCurrentDoc | null>(null)
  /** 当前定位页（ppt_select 驱动，渲染器联动跳转） */
  readonly currentPage = ref(1)
  /** 渲染缓存：每页一个 SVG 字符串 */
  readonly svgs = ref<string[]>([])
  readonly renderState = ref<PptRenderState>('idle')
  /** 最近一次渲染失败的错误文本（AI 经 ppt_read 读取自行修正） */
  readonly renderError = ref('')

  private renderTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly sandboxDir: string) {
    // 文档变更 → 500ms 防抖自动渲染（长生命周期单例，watch 无需手动停止）
    watch(
      () => this.current.value?.xml,
      () => this.scheduleRender()
    )
  }

  /** 重新扫描 outputs/ 下的 slides 版本文件列表 */
  async refreshFiles(): Promise<PptFileInfo[]> {
    const dir = buildPptOutputsDir(this.sandboxDir)
    if (!window.preload.fs.existsSync(dir)) {
      this.files.value = []
      return this.files.value
    }
    const items = await window.preload.fs.readDir(dir)
    const infos: PptFileInfo[] = []
    for (const item of items) {
      if (!item.isFile) continue
      const version = parseSlidesVersion(item.name)
      if (version === null) continue
      infos.push({ version, name: item.name, path: item.path, updatedTime: item.mtime })
    }
    // 按版本升序，稳定的 t-select 展示顺序
    infos.sort((a, b) => a.version - b.version)
    this.files.value = infos
    return this.files.value
  }

  /** 打开指定版本为当前文档（返回 null 表示版本不存在） */
  async open(version: number): Promise<PptCurrentDoc | null> {
    const path = window.preload.path.join(buildPptOutputsDir(this.sandboxDir), buildSlidesFileName(version))
    if (!window.preload.fs.existsSync(path)) return null
    const xml = await window.preload.fs.readTextFile(path)
    const doc: PptCurrentDoc = { version, name: `slides-${version}`, xml }
    this.current.value = doc
    this.currentPage.value = 1
    await this.refreshFiles()
    return doc
  }

  /**
   * 读取指定版本（缺省当前版本）的 POM XML 文本，附渲染状态供 AI 自纠。
   * 返回 null 表示版本不存在。
   */
  async read(version?: number): Promise<{
    content: string
    version: number
    renderState: PptRenderState
    renderError: string
  } | null> {
    const doc = this.current.value
    const targetVersion = version ?? doc?.version
    if (targetVersion == null) return null
    const path = window.preload.path.join(
      buildPptOutputsDir(this.sandboxDir),
      buildSlidesFileName(targetVersion)
    )
    if (!window.preload.fs.existsSync(path)) return null
    const content = await window.preload.fs.readTextFile(path)
    return {
      content,
      version: targetVersion,
      renderState: this.renderState.value,
      renderError: this.renderError.value
    }
  }

  /** 创建新 PPT（自动分配 slides-{下一个版本号}）并设为当前文档 */
  async create(input: { title?: string } = {}): Promise<PptCurrentDoc> {
    await this.refreshFiles()
    const version = nextVersionOf(this.files.value)
    const doc: PptCurrentDoc = { version, name: `slides-${version}`, xml: buildCreateXml(input.title ?? '演示文稿') }
    await this.persist(doc)
    this.current.value = doc
    this.currentPage.value = 1
    await this.refreshFiles()
    return doc
  }

  /** 删除指定版本文件（删除的是当前文档时清空当前态） */
  async delete(version: number): Promise<void> {
    const path = window.preload.path.join(buildPptOutputsDir(this.sandboxDir), buildSlidesFileName(version))
    if (window.preload.fs.existsSync(path)) {
      await window.preload.fs.rm(path)
    }
    if (this.current.value?.version === version) {
      this.current.value = null
      this.svgs.value = []
      this.renderState.value = 'idle'
      this.renderError.value = ''
    }
    await this.refreshFiles()
  }

  /**
   * 批量编辑（slide 粒度）：两阶段 —— 先全量校验（片段 parseXml + 越界检查），
   * 任一失败整体回滚（不落盘）；全部通过后 serializeXml 写回新版本文件。
   * 索引基于「顺序执行时当前页数组」（op 间相互可见，与 canvas batch_edit 顺序语义一致）。
   */
  async batchEdit(
    ops: PptBatchOp[]
  ): Promise<{ error: string } | { success: true; version: number; name: string }> {
    const doc = this.current.value
    if (!doc) return { error: '当前没有打开的 PPT，请先 ppt_create 或 ppt_open' }
    let pages: POMNode[]
    try {
      pages = parseXml(doc.xml)
    } catch (err) {
      return { error: `当前 PPT XML 解析失败：${errorText(err)}` }
    }
    // 阶段一：全部 xml 片段预解析校验（add 可多页；update/rewrite 必须恰好 1 页）
    const prepared: { op: PptBatchOp; nodes: POMNode[] | null }[] = []
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i]
      if (op.op === 'add' || op.op === 'update' || op.op === 'rewrite') {
        let nodes: POMNode[]
        try {
          nodes = parseXml(op.xml)
        } catch (err) {
          return { error: `第 ${i + 1} 个操作（${op.op}）的 XML 非法：${errorText(err)}` }
        }
        if (op.op !== 'add' && nodes.length !== 1) {
          return {
            error: `第 ${i + 1} 个操作（${op.op}）的 XML 片段必须恰好包含 1 页（<Slide>），实际 ${nodes.length} 页`
          }
        }
        prepared.push({ op, nodes })
      } else {
        prepared.push({ op, nodes: null })
      }
    }
    // 阶段二：顺序执行（索引基于当前数组；任一失败整体放弃，不落盘）
    const next = [...pages]
    for (let i = 0; i < prepared.length; i++) {
      const { op } = prepared[i]
      const outOfRange = (index: number): string =>
        `第 ${i + 1} 个操作（${op.op}）的页码越界：${index}（当前共 ${next.length} 页）`
      switch (op.op) {
        case 'add': {
          const at = op.at ?? next.length
          if (at < 0 || at > next.length) return { error: outOfRange(at) }
          next.splice(at, 0, ...(prepared[i].nodes as POMNode[]))
          break
        }
        case 'update': {
          if (op.index < 0 || op.index >= next.length) return { error: outOfRange(op.index) }
          next[op.index] = (prepared[i].nodes as POMNode[])[0]
          break
        }
        case 'remove': {
          if (op.index < 0 || op.index >= next.length) return { error: outOfRange(op.index) }
          next.splice(op.index, 1)
          break
        }
        case 'move': {
          if (op.from < 0 || op.from >= next.length || op.to < 0 || op.to >= next.length) {
            return { error: `第 ${i + 1} 个操作（move）的页码越界：from ${op.from} / to ${op.to}（当前共 ${next.length} 页）` }
          }
          const [item] = next.splice(op.from, 1)
          next.splice(op.to, 0, item)
          break
        }
        case 'rewrite': {
          const nodes = prepared[i].nodes as POMNode[]
          if (nodes.length === 0) return { error: `第 ${i + 1} 个操作（rewrite）的 XML 为空` }
          next.splice(0, next.length, ...nodes)
          break
        }
      }
    }
    if (next.length === 0) return { error: '编辑后没有任何页面，请保留至少 1 页' }
    const xml = serializeXml(next)
    await this.refreshFiles()
    const version = nextVersionOf(this.files.value)
    const newDoc: PptCurrentDoc = { version, name: `slides-${version}`, xml }
    await this.persist(newDoc)
    this.current.value = newDoc
    await this.refreshFiles()
    return { success: true, version: newDoc.version, name: newDoc.name }
  }

  /** 定位到指定页（渲染器联动跳转；越界给错误反馈，AI 自纠） */
  selectPage(page: number): { error: string } | { success: true } {
    if (page < 1) return { error: `页码越界：${page}（页码从 1 开始）` }
    if (this.svgs.value.length > 0 && page > this.svgs.value.length) {
      return { error: `页码越界：${page}（当前共 ${this.svgs.value.length} 页）` }
    }
    this.currentPage.value = page
    return { success: true }
  }

  // ─── 内部：渲染 ──────────────────────────────────────

  /** 500ms 防抖自动渲染（watch(current.xml) 触发） */
  private scheduleRender(): void {
    if (this.renderTimer) clearTimeout(this.renderTimer)
    this.renderTimer = setTimeout(() => {
      this.renderTimer = null
      void this.render()
    }, 500)
  }

  /** 渲染当前文档为每页 SVG；失败保留旧图并记录 renderError（AI 经 ppt_read 读取） */
  private async render(): Promise<void> {
    const doc = this.current.value
    if (!doc) {
      this.svgs.value = []
      this.renderState.value = 'idle'
      this.renderError.value = ''
      return
    }
    this.renderState.value = 'rendering'
    try {
      const svgs = await renderPptxToSvgs(doc.xml, PPT_SLIDE_SIZE)
      this.svgs.value = svgs
      this.renderState.value = 'idle'
      this.renderError.value = ''
      if (this.currentPage.value > svgs.length) this.currentPage.value = Math.max(1, svgs.length)
    } catch (err) {
      this.renderState.value = 'error'
      this.renderError.value = errorText(err)
      console.error('[ppt] 渲染失败，保留旧图：', this.renderError.value)
    }
  }

  private async persist(doc: PptCurrentDoc): Promise<void> {
    const dir = buildPptOutputsDir(this.sandboxDir)
    if (!window.preload.fs.existsSync(dir)) {
      await window.preload.fs.mkdir(dir, true)
    }
    const path = window.preload.path.join(dir, buildSlidesFileName(doc.version))
    await window.preload.fs.writeTextFile(path, doc.xml)
  }
}

const stores = new Map<string, PptStore>()

/** 获取指定沙盒目录的 PPT store（存在即复用，跨组件与工具共享同一响应式实例） */
export const getPptStore = (sandboxDir: string): PptStore => {
  let store = stores.get(sandboxDir)
  if (!store) {
    store = new PptStore(sandboxDir)
    stores.set(sandboxDir, store)
  }
  return store
}

/** 销毁指定沙盒目录的 PPT store（聊天删除时调用，释放内存） */
export const destroyPptStore = (sandboxDir: string): void => {
  stores.delete(sandboxDir)
}
