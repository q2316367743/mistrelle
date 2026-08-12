/**
 * PPT 响应式 store（按 sandboxDir 键控的全局单例，同 CanvasStore 模式）：
 * - 工具与侧边栏共享同一实例：AI 变更（写沙盒 outputs/{name}.pom.xml）实时驱动渲染
 * - 文件模型：单一文件持续编辑（ppt_create 定文件名 + Theme，之后 addSlide / editSlide 原地写回，
 *   不再产生版本文件）；文件内多个 <Slide> 即多页
 * - watch(current.xml) → 500ms 防抖 → 主进程渲染每页 SVG；失败保留旧图并记录错误
 * - 页面编辑链路：JSON 元素数组 → TypeBox 校验（pptSchemas）→ POMNode 组装 →
 *   serializeXml 写回（round-trip 可 parse，已 POC 验证）
 */
import { ref, watch } from 'vue'
import { parseXml, serializeXml } from '@hirokisakabe/pom/clientApi'
import type { POMNode } from '@hirokisakabe/pom/clientApi'
import { renderPptxToSvgs } from './pptRender'
import { validatePptElements, validatePptTheme } from './pptSchemas'
import type { PptCurrentDoc, PptFileInfo, PptRenderState, PptTheme } from './pptTypes'
import { PPT_SLIDE_SIZE } from './pptTypes'

const PPT_FILE_REGEX = /^(.+)\.pom\.xml$/

/** 从文件名解析 PPT 标识（id = 去扩展名的 name），非 PPT 文件返回 null */
export const parsePptFile = (name: string): string | null => {
  const match = PPT_FILE_REGEX.exec(name)
  return match ? match[1] : null
}

export const buildPptFileName = (name: string): string => `${name}.pom.xml`

/** 输出目录：~/.mistrelle/workspace/{chatId}/outputs */
export const buildPptOutputsDir = (sandboxDir: string): string =>
  window.preload.path.join(sandboxDir, 'outputs')

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/** 空页占位：铺满画布的空白 VStack（addSlide 缺省内容） */
const EMPTY_SLIDE_NODE: POMNode = {
  type: 'vstack',
  w: '100%',
  h: '100%',
  padding: 48,
  children: []
} as unknown as POMNode

/**
 * 元素数组 → 页面根节点（对齐 parseXml 对 <Slide> 多子元素的隐式 VStack 包裹语义）：
 * 1 个元素直接用；多个元素包 {type:'vstack', children}。
 */
const toSlideNode = (elements: POMNode[]): POMNode =>
  elements.length === 1 ? elements[0] : ({ type: 'vstack', children: elements } as POMNode)

/** 构建主题声明：<Theme token="hex" ... />（无令牌时返回空串） */
const buildThemeXml = (theme: PptTheme): string => {
  const attrs = Object.entries(theme)
    .map(([key, value]) => `${key}="${value.replace(/^#/, '')}"`)
    .join(' ')
  return attrs ? `<Theme ${attrs} />` : ''
}

/**
 * 从文件头部提取 <Theme ... /> 声明。
 * 注意：POM 的 parseXml 把 <Theme> 解析为色板（不保留为节点），serializeXml 写回会丢失它，
 * 因此页面编辑写回时必须把 Theme 声明拼回文件头，保证 $token 引用持续有效。
 */
const extractThemeXml = (xml: string): string => {
  const match = /^\s*<Theme\b[^>]*\/?>(?:<\/Theme>)?\s*/.exec(xml)
  return match ? match[0].trim() : ''
}

/**
 * 补全 Table 的 columns（POM 的 parseXml 对 rows="..." JSON 属性形式不会自动补 columns，
 * 仅 <Tr> 子元素形式会；缺失时布局阶段 calcTableIntrinsicSize 报错）。
 * 递归处理子树；列数 = 各行单元格数最大值（含 colspan）。
 */
const normalizeTableColumns = (node: POMNode): void => {
  if (node.type === 'table') {
    const rows = node.rows
    if (node.columns === undefined && Array.isArray(rows) && rows.length > 0) {
      const maxCells = Math.max(
        ...rows.map((row) => row.cells?.reduce((sum, cell) => sum + (cell.colspan ?? 1), 0) ?? 0)
      )
      node.columns = Array.from({ length: maxCells }, () => ({}))
    }
  }
  if ('children' in node && Array.isArray(node.children)) node.children.forEach(normalizeTableColumns)
}

/**
 * 规避 POM 布局 bug（10.3.0 实测）：**嵌套 HStack 链中的 Text 若未显式声明 w，
 * 布局测量得到 NaN 宽度 → buildPptx 抛 addTextBox: width must be a finite positive EMU value**。
 * 触发条件：Text 的祖先存在 ≥2 层且均无显式像素宽度的 HStack（胶囊标签 / 徽章 / 图标+文字组合常见）；
 * 显式声明 w（含 w="max"）走非测量路径即正常。这里自动给受影响 Text 补 w="max"（视觉等价，
 * 父级为 hug 时解析为内容宽），AI 无需感知。
 */
const normalizeHStackText = (node: POMNode, hstackChain: number): void => {
  if (node.type === 'hstack') {
    const hasPixelW = typeof node.w === 'number'
    const chain = hasPixelW ? 0 : hstackChain + 1
    if ('children' in node && Array.isArray(node.children)) {
      node.children.forEach((child) => normalizeHStackText(child, chain))
    }
    return
  }
  if (node.type === 'text' && node.w === undefined && hstackChain >= 2) {
    node.w = 'max'
  }
  if ('children' in node && Array.isArray(node.children)) {
    node.children.forEach((child) => normalizeHStackText(child, hstackChain))
  }
}

/** 页面操作返回（error 或 success + 1 起始 slideId） */
export type PptPageResult = { error: string } | { success: true; slideId: number; total: number }

export class PptStore {
  /** outputs/ 下的 PPT 文件列表（id = 文件名） */
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

  /** 打开指定 PPT 为当前文档（返回 null 表示不存在） */
  async open(id: string): Promise<PptCurrentDoc | null> {
    const path = window.preload.path.join(buildPptOutputsDir(this.sandboxDir), buildPptFileName(id))
    if (!window.preload.fs.existsSync(path)) return null
    const xml = await window.preload.fs.readTextFile(path)
    const doc: PptCurrentDoc = { id, name: buildPptFileName(id), xml }
    this.current.value = doc
    this.currentPage.value = 1
    await this.refreshFiles()
    return doc
  }

  /**
   * 读取指定 PPT（缺省当前）的 POM XML，附渲染状态供 AI 自纠。
   * slideId（1 起始）给定时只返回该页的 <Slide> 片段（聚焦单页编辑）。
   * 返回 null 表示文件不存在；{ error } 表示解析失败。
   */
  async read(
    id?: string,
    slideId?: number
  ): Promise<{ error: string } | {
    content: string
    id: string
    page?: number
    renderState: PptRenderState
    renderError: string
  } | null> {
    const doc = this.current.value
    const targetId = id ?? doc?.id
    if (!targetId) return null
    const path = window.preload.path.join(buildPptOutputsDir(this.sandboxDir), buildPptFileName(targetId))
    if (!window.preload.fs.existsSync(path)) return null
    const content = await window.preload.fs.readTextFile(path)
    let pageContent = content
    let page: number | undefined
    if (slideId != null) {
      let pages: POMNode[]
      try {
        pages = parseXml(content)
      } catch (err) {
        return { error: `PPT XML 解析失败：${errorText(err)}` }
      }
      if (!Number.isInteger(slideId) || slideId < 1 || slideId > pages.length) {
        return { error: `页码越界：${slideId}（当前共 ${pages.length} 页，从 1 开始）` }
      }
      pageContent = serializeXml([pages[slideId - 1]])
      page = slideId
    }
    return {
      content: pageContent,
      id: targetId,
      ...(page != null ? { page } : {}),
      renderState: this.renderState.value,
      renderError: this.renderError.value
    }
  }

  /**
   * 创建新 PPT：指定文件名（id）+ Theme 令牌，写 <Theme .../>（0 页）。
   * 重名报错（不覆盖，AI 换名或先删除旧文件）。
   */
  async create(input: { name: string; theme?: PptTheme }): Promise<{ error: string } | { success: true; id: string; path: string }> {
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
    const xml = buildThemeXml(input.theme ?? {})
    const doc: PptCurrentDoc = { id: name, name: buildPptFileName(name), xml }
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
  async addSlide(
    id: string | undefined,
    elements?: unknown[]
  ): Promise<PptPageResult> {
    return this.withPages(id, (pages) => {
      const nodes = elements && elements.length > 0 ? this.prepareElements(elements) : [EMPTY_SLIDE_NODE]
      pages.push(toSlideNode(nodes))
      return { success: true, slideId: pages.length, total: pages.length }
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
    return this.withPages(id, (pages) => {
      if (!Number.isInteger(slideId) || slideId < 1 || slideId > pages.length) {
        return { error: `页码越界：${slideId}（当前共 ${pages.length} 页，从 1 开始）` }
      }
      const nodes = this.prepareElements(elements)
      pages[slideId - 1] = toSlideNode(nodes)
      return { success: true, slideId, total: pages.length }
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

  // ─── 内部：页面读写（读文件 → 校验元素 → 应用 → serializeXml 写回） ──

  /** 元素数组 → POMNode[]：TypeBox 校验（中文错误反馈），非法抛错 */
  private prepareElements(elements: unknown[]): POMNode[] {
    if (!Array.isArray(elements) || elements.length === 0) {
      throw new Error('elements 不能为空：页面至少包含 1 个元素（根元素建议为 VStack / HStack 布局容器）')
    }
    const errors = validatePptElements(elements)
    if (errors.length) {
      throw new Error(`元素校验失败：${errors.join('；')}`)
    }
    const nodes = elements as POMNode[]
    // POM 布局边界规避：Table columns 补全 + 嵌套 HStack 链中 Text 补 w（详见函数注释）
    nodes.forEach((node) => {
      normalizeTableColumns(node)
      normalizeHStackText(node, 0)
    })
    return nodes
  }

  /**
   * 页面操作公共链路：打开文件（pptId 缺省当前）→ parseXml → 应用操作 →
   * serializeXml 写回（原地更新，不产生新版本）；操作抛错则整体拒绝。
   */
  private async withPages(id: string | undefined, apply: (pages: POMNode[]) => PptPageResult): Promise<PptPageResult> {
    const doc = this.current.value
    const targetId = id ?? doc?.id
    if (!targetId) return { error: '未指定 PPT，且当前没有打开的 PPT（先 ppt_create 或 ppt_open）' }
    const path = window.preload.path.join(buildPptOutputsDir(this.sandboxDir), buildPptFileName(targetId))
    if (!window.preload.fs.existsSync(path)) {
      return { error: `未找到 PPT「${targetId}」` }
    }
    let xml: string
    try {
      xml = await window.preload.fs.readTextFile(path)
    } catch (err) {
      return { error: `读取失败：${errorText(err)}` }
    }
    let pages: POMNode[]
    try {
      pages = parseXml(xml)
    } catch (err) {
      return { error: `PPT XML 解析失败：${errorText(err)}` }
    }
    let result: PptPageResult
    try {
      result = apply(pages)
    } catch (err) {
      return { error: errorText(err) }
    }
    if ('error' in result) return result
    try {
      // serializeXml 不保留 <Theme>（parseXml 已解析为色板），写回时拼回文件头的 Theme 声明
      const themeXml = extractThemeXml(xml)
      const newXml = themeXml ? `${themeXml}\n${serializeXml(pages)}` : serializeXml(pages)
      // 写回前校验：serializeXml 宽容（坏数据如 svg w="max" 会静默落盘，下次读取 parseXml 才炸），
      // 这里立即用 parseXml 严格校验拦截，错误当场反馈 AI，避免坏数据污染文件
      try {
        parseXml(newXml)
      } catch (err) {
        return { error: `XML 校验未通过（未写入）：${errorText(err)}` }
      }
      await this.persist({ id: targetId, name: buildPptFileName(targetId), xml: newXml })
      if (this.current.value?.id === targetId) {
        // 原地更新当前文档（对象替换触发 watch 自动渲染）
        this.current.value = { id: targetId, name: buildPptFileName(targetId), xml: newXml }
      }
    } catch (err) {
      return { error: `写入失败：${errorText(err)}` }
    }
    return result
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
      const message = errorText(err)
      // POM 布局边界提示：嵌套 HStack 链中文本宽度 NaN（normalize 已自动规避，此处兜底说明）
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
