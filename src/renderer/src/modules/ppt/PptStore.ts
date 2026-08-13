/**
 * PPT 响应式 store（按 sandboxDir 键控的全局单例，同 CanvasStore 模式）：
 * - 工具与侧边栏共享同一实例：AI 变更（写沙盒 outputs/{name}.ppt.json）实时驱动渲染
 * - 文件模型：单一文件持续编辑（ppt_create 定文件名 + Theme，之后 addSlide / editSlide 原地写回，
 *   不再产生版本文件）；文件内 slide 数组即多页
 * - 全程 JSON（SlideNode），渲染进程不涉及 xml：watch(current.json) → 500ms 防抖 →
 *   主进程 jsonToPomXml → buildPptx 渲染每页 SVG；失败保留旧图并记录错误
 * - 页面编辑链路：SlideNode 数组 → TypeBox 校验（pptSchemas）→ 原地写回（JSON 存储）
 */
import { ref, watch } from 'vue'
import { renderPptxToSvgs } from './pptRender'
import { validatePptElements, validatePptTheme } from './pptSchemas'
import type {
  PptCurrentDoc,
  PptFileInfo,
  PptJsonDoc,
  PptRenderState,
  PptTheme,
  SlideNode
} from './pptTypes'
import { PPT_SLIDE_SIZE } from './pptTypes'
import { cloneDeep } from 'es-toolkit'

const PPT_FILE_REGEX = /^(.+)\.ppt\.json$/

/** 从文件名解析 PPT 标识（id = 去扩展名的 name），非 PPT 文件返回 null */
export const parsePptFile = (name: string): string | null => {
  const match = PPT_FILE_REGEX.exec(name)
  return match ? match[1] : null
}

export const buildPptFileName = (name: string): string => `${name}.ppt.json`

/** 输出目录：~/.mistrelle/workspace/{chatId}/outputs */
export const buildPptOutputsDir = (sandboxDir: string): string =>
  window.preload.path.join(sandboxDir, 'outputs')

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/** 空页占位：铺满画布的空白 VStack（addSlide 缺省内容） */
const EMPTY_SLIDE_NODE: SlideNode = {
  tag: 'VStack',
  attr: { w: '100%', h: '100%', padding: '48' },
  child: []
}

/**
 * 解析文件文本为 PptJsonDoc（JSON.parse + 轻量结构校验）。
 * slide 每页必须是元素数组；深层节点结构由 TypeBox 校验保证。
 */
const parseDoc = (text: string): { error: string } | { doc: PptJsonDoc } => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    return { error: `PPT JSON 解析失败：${errorText(err)}` }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: 'PPT JSON 结构非法：根节点应为对象' }
  }
  const doc = parsed as { name?: unknown; slide?: unknown }
  if (typeof doc.name !== 'string') return { error: 'PPT JSON 结构非法：缺少 name 字段' }
  if (!Array.isArray(doc.slide) || doc.slide.some((page) => !Array.isArray(page))) {
    return { error: 'PPT JSON 结构非法：slide 应为数组，且每页为元素数组' }
  }
  return { doc: parsed as PptJsonDoc }
}

/**
 * attr 值规范化：schema 允许 string / number / boolean（AI 友好），
 * 落盘前统一转为字符串（存储契约 attr: Record<string, string>）。递归处理子树。
 */
const normalizeAttrValues = (node: SlideNode): void => {
  for (const [key, value] of Object.entries(node.attr)) {
    if (typeof value !== 'string') node.attr[key] = String(value)
  }
  if (Array.isArray(node.child)) node.child.forEach(normalizeAttrValues)
}

/** 页面操作返回（error 或 success + 1 起始 slideId） */
export type PptPageResult = { error: string } | { success: true; slideId: number; total: number }

export class PptStore {
  /** outputs/ 下的 PPT 文件列表（id = 文件名） */
  readonly files = ref<PptFileInfo[]>([])
  /** 当前打开的文档（AI / 侧边栏共享，json 变更驱动自动渲染） */
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
      () => this.current.value?.json,
      () => this.scheduleRender()
    )
  }

  /** 重新扫描 outputs/ 下的 PPT 文件列表 */
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
      const id = parsePptFile(item.name)
      if (id === null) continue
      infos.push({ id, name: item.name, path: item.path, updatedTime: item.mtime })
    }
    infos.sort((a, b) => a.name.localeCompare(b.name))
    this.files.value = infos
    return this.files.value
  }

  /** 打开指定 PPT 为当前文档（返回 null 表示不存在 / 文件损坏） */
  async open(id: string): Promise<PptCurrentDoc | null> {
    const path = window.preload.path.join(buildPptOutputsDir(this.sandboxDir), buildPptFileName(id))
    if (!window.preload.fs.existsSync(path)) return null
    const text = await window.preload.fs.readTextFile(path)
    const parsed = parseDoc(text)
    if ('error' in parsed) return null
    const doc: PptCurrentDoc = { id, name: buildPptFileName(id), json: parsed.doc }
    this.current.value = doc
    this.currentPage.value = 1
    await this.refreshFiles()
    return doc
  }

  /**
   * 读取指定 PPT（缺省当前）的 JSON，附渲染状态供 AI 自纠。
   * slideId（1 起始）给定时只返回该页的 SlideNode 数组（聚焦单页编辑）。
   * 返回 null 表示文件不存在；{ error } 表示解析失败。
   */
  async read(id?: string): Promise<
    | { error: string }
    | {
        content: PptJsonDoc
        id: string
        renderState: PptRenderState
        renderError: string
      }
    | null
  >
  async read(
    id: string | undefined,
    slideId: number
  ): Promise<
    | { error: string }
    | {
        content: SlideNode[]
        id: string
        page: number
        renderState: PptRenderState
        renderError: string
      }
    | null
  >
  async read(
    id?: string,
    slideId?: number
  ): Promise<
    | { error: string }
    | {
        content: PptJsonDoc | SlideNode[]
        id: string
        page?: number
        renderState: PptRenderState
        renderError: string
      }
    | null
  > {
    const doc = this.current.value
    const targetId = id ?? doc?.id
    if (!targetId) return null
    const path = window.preload.path.join(
      buildPptOutputsDir(this.sandboxDir),
      buildPptFileName(targetId)
    )
    if (!window.preload.fs.existsSync(path)) return null
    const text = await window.preload.fs.readTextFile(path)
    const parsed = parseDoc(text)
    if ('error' in parsed) return parsed
    const json = parsed.doc
    if (slideId != null) {
      if (!Number.isInteger(slideId) || slideId < 1 || slideId > json.slide.length) {
        return { error: `页码越界：${slideId}（当前共 ${json.slide.length} 页，从 1 开始）` }
      }
      return {
        content: json.slide[slideId - 1],
        id: targetId,
        page: slideId,
        renderState: this.renderState.value,
        renderError: this.renderError.value
      }
    }
    return {
      content: json,
      id: targetId,
      renderState: this.renderState.value,
      renderError: this.renderError.value
    }
  }

  /**
   * 创建新 PPT：指定文件名（id）+ Theme 令牌，写 PptJsonDoc（0 页）。
   * 重名报错（不覆盖，AI 换名或先删除旧文件）。
   */
  async create(input: {
    name: string
    theme?: PptTheme
  }): Promise<{ error: string } | { success: true; id: string; path: string }> {
    const name = input.name?.trim()
    if (!name) return { error: 'name 不能为空：请为 PPT 指定文件名（如「产品发布会」）' }
    if (!/^[A-Za-z0-9\u4e00-\u9fa5_-]{1,60}$/.test(name)) {
      return { error: `文件名「${name}」非法：1-60 字符，仅允许中文 / 字母 / 数字 / _ / -` }
    }
    const themeErrors = validatePptTheme(input.theme ?? {})
    if (themeErrors.length) return { error: themeErrors.join('；') }
    await this.refreshFiles()
    if (this.files.value.some((f) => f.id === name)) {
      return { error: `已存在同名 PPT「${name}」，请换一个文件名，或先 ppt_delete 删除旧文件` }
    }
    const now = Date.now()
    const json: PptJsonDoc = {
      name,
      createdAt: now,
      updatedAt: now,
      theme: input.theme ?? {},
      slide: []
    }
    const doc: PptCurrentDoc = { id: name, name: buildPptFileName(name), json }
    await this.persist(doc)
    this.current.value = doc
    this.currentPage.value = 1
    await this.refreshFiles()
    return { success: true, id: name, path: doc.name }
  }

  /**
   * 新增一页（Slide）到文件末尾，返回 1 起始索引。
   * elements 缺省 / 为空 → 空白页（铺满画布的 VStack）；非空经 TypeBox 校验（任一非法整体拒绝）。
   */
  async addSlide(id: string | undefined, elements?: unknown[]): Promise<PptPageResult> {
    return this.withPages(id, (slide) => {
      const page =
        elements && elements.length > 0 ? this.prepareElements(elements) : [EMPTY_SLIDE_NODE]
      slide.push(page)
      return { success: true, slideId: slide.length, total: slide.length }
    })
  }

  /**
   * 替换指定页（slideId 1 起始）内容为元素数组（整页覆盖）。
   * 元素经 TypeBox 校验；任一非法或页码越界整体拒绝，不写文件。
   */
  async editSlide(
    id: string | undefined,
    slideId: number,
    elements: unknown[]
  ): Promise<PptPageResult> {
    return this.withPages(id, (slide) => {
      if (!Number.isInteger(slideId) || slideId < 1 || slideId > slide.length) {
        return { error: `页码越界：${slideId}（当前共 ${slide.length} 页，从 1 开始）` }
      }
      slide[slideId - 1] = this.prepareElements(elements)
      return { success: true, slideId, total: slide.length }
    })
  }

  /** 删除指定 PPT 文件（删除的是当前文档时清空当前态） */
  async delete(id: string): Promise<void> {
    const path = window.preload.path.join(buildPptOutputsDir(this.sandboxDir), buildPptFileName(id))
    if (window.preload.fs.existsSync(path)) {
      await window.preload.fs.rm(path)
    }
    if (this.current.value?.id === id) {
      this.current.value = null
      this.svgs.value = []
      this.renderState.value = 'idle'
      this.renderError.value = ''
    }
    await this.refreshFiles()
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

  // ─── 内部：页面读写（读文件 → 校验元素 → 应用 → JSON 写回） ──

  /**
   * 元素数组 → 页面 SlideNode[]：TypeBox 校验（中文错误反馈）+ attr 值规范化，
   * 非法抛错。布局边界规避（嵌套 HStack 链 Text 补 w）由主进程 jsonToPomXml 负责，渲染进程不做。
   */
  private prepareElements(elements: unknown[]): SlideNode[] {
    if (!Array.isArray(elements) || elements.length === 0) {
      throw new Error(
        'elements 不能为空：页面至少包含 1 个元素（根元素建议为 VStack / HStack 布局容器）'
      )
    }
    const errors = validatePptElements(elements)
    if (errors.length) {
      throw new Error(`元素校验失败：${errors.join('；')}`)
    }
    const nodes = elements as SlideNode[]
    nodes.forEach(normalizeAttrValues)
    return nodes
  }

  /**
   * 页面操作公共链路：打开文件（pptId 缺省当前）→ JSON 解析 → 应用操作 →
   * JSON 写回（原地更新，不产生新版本）；操作抛错则整体拒绝。
   */
  private async withPages(
    id: string | undefined,
    apply: (slide: SlideNode[][]) => PptPageResult
  ): Promise<PptPageResult> {
    const doc = this.current.value
    const targetId = id ?? doc?.id
    if (!targetId) return { error: '未指定 PPT，且当前没有打开的 PPT（先 ppt_create 或 ppt_open）' }
    const path = window.preload.path.join(
      buildPptOutputsDir(this.sandboxDir),
      buildPptFileName(targetId)
    )
    if (!window.preload.fs.existsSync(path)) {
      return { error: `未找到 PPT「${targetId}」` }
    }
    let text: string
    try {
      text = await window.preload.fs.readTextFile(path)
    } catch (err) {
      return { error: `读取失败：${errorText(err)}` }
    }
    const parsed = parseDoc(text)
    if ('error' in parsed) return parsed
    const json = parsed.doc
    let result: PptPageResult
    try {
      result = apply(json.slide)
    } catch (err) {
      return { error: errorText(err) }
    }
    if ('error' in result) return result
    json.updatedAt = Date.now()
    try {
      await this.persist({ id: targetId, name: buildPptFileName(targetId), json })
      if (this.current.value?.id === targetId) {
        // 原地更新当前文档（对象替换触发 watch 自动渲染）
        this.current.value = { id: targetId, name: buildPptFileName(targetId), json }
      }
    } catch (err) {
      return { error: `写入失败：${errorText(err)}` }
    }
    return result
  }

  // ─── 内部：渲染 ──────────────────────────────────────

  /** 500ms 防抖自动渲染（watch(current.json) 触发） */
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
      const svgs = await renderPptxToSvgs(cloneDeep(doc.json), PPT_SLIDE_SIZE)
      this.svgs.value = svgs
      this.renderState.value = 'idle'
      this.renderError.value = ''
      if (this.currentPage.value > svgs.length) this.currentPage.value = Math.max(1, svgs.length)
    } catch (err) {
      this.renderState.value = 'error'
      const message = errorText(err)
      // POM 布局边界提示：嵌套 HStack 链中文本宽度 NaN（主进程已自动规避，此处兜底说明）
      this.renderError.value = /addTextBox|finite/.test(message)
        ? `${message}\n提示：POM 布局边界——嵌套 HStack 中的文本需要显式宽度（w），已自动处理；若仍失败请检查是否有异常布局（如无宽度容器直接嵌套）`
        : message
      console.error('[ppt] 渲染失败，保留旧图：', this.renderError.value)
    }
  }

  private async persist(doc: PptCurrentDoc): Promise<void> {
    const dir = buildPptOutputsDir(this.sandboxDir)
    if (!window.preload.fs.existsSync(dir)) {
      await window.preload.fs.mkdir(dir, true)
    }
    const path = window.preload.path.join(dir, buildPptFileName(doc.id))
    await window.preload.fs.writeTextFile(path, JSON.stringify(doc.json, null, 2))
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
