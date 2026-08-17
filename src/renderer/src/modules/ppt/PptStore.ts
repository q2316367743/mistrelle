/**
 * PPT 响应式 store（按 sandboxDir 键控的全局单例，同 CanvasStore 模式）：
 * - 工具与侧边栏共享同一实例：AI 变更（写沙盒 outputs/{name}.ppt.json）实时驱动渲染
 * - 文件模型：单一文件持续编辑（ppt_create 定文件名 + Theme + 初始页数，之后 addSlide / batchEdit
 *   原地写回，不再产生版本文件）；文件内 slide 数组即多页（每页为空数组或元素数组）
 * - 全程 JSON（SlideNode）：预览由 vueRender 组件直接消费（current.json 响应式直驱），
 *   导出经离屏快照 → 主进程 PptxGenJS（见 vueRender/offscreen.ts 与 pptRender.ts）
 * - 页面编辑链路：ppt_batch_edit 批量操作（insert / copy / update / move / delete，仿 canvas，
 *   单操作容错）→ TypeBox 校验（pptSchemas）→ 原地写回（JSON 存储）
 */
import { ref } from 'vue'
import { validatePptTheme } from './pptSchemas'
import { collectPageNodes, ensureNodeIds, filterNodesByIds } from './pptNodeId'
import type { PptNodeInfo } from './pptNodeId'
import { executePptBatchOps } from './pptBatchOps'
import { buildPptFileName, buildPptOutputsDir, errorText, parseDoc, parsePptFile } from './pptFile'
import type { PptCurrentDoc, PptFileInfo, PptJsonDoc, PptTheme, SlideNode } from './pptTypes'

/** 页面操作返回（error 或 success + 1 起始 slideId；nodes 为受影响页全部节点摘要，供 AI 引用 id） */
export type PptPageResult =
  | { error: string }
  | { success: true; slideId: number; total: number; nodes?: PptNodeInfo[] }

/** ppt_batch_edit 返回：单操作容错，results 内联每个 op 的结果 / 错误 */
export type PptBatchEditResult =
  | { error: string }
  | {
      success: true
      slideId: number
      total: number
      results: unknown[]
      potentialIssues: string[]
      nodes?: PptNodeInfo[]
    }

export class PptStore {
  /** outputs/ 下的 PPT 文件列表（id = 文件名） */
  readonly files = ref<PptFileInfo[]>([])
  /** 当前打开的文档（AI / 侧边栏共享，json 响应式直驱 vueRender 预览） */
  readonly current = ref<PptCurrentDoc | null>(null)
  /** 当前定位页（ppt_select 驱动，渲染器联动跳转） */
  readonly currentPage = ref(1)

  constructor(private readonly sandboxDir: string) {}

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
    // AI 手写文件可能缺 id：加载时补齐（内存态；下次写回时随 JSON 落盘）
    parsed.doc.slide.forEach(ensureNodeIds)
    const doc: PptCurrentDoc = { id, name: buildPptFileName(id), json: parsed.doc }
    this.current.value = doc
    this.currentPage.value = 1
    await this.refreshFiles()
    return doc
  }

  /** 读取指定 PPT（缺省当前）的完整 JSON（导出工具用）。返回 null 表示文件不存在 */
  async read(id?: string): Promise<{ error: string } | { content: PptJsonDoc; id: string } | null> {
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
    json.slide.forEach(ensureNodeIds)
    return { content: json, id: targetId }
  }

  /** 文档级信息（ppt_info 工具）：id / name / 页数 / theme。返回 null 表示文件不存在 */
  async info(
    id?: string
  ): Promise<{ error: string } | { id: string; name: string; slideCount: number; theme: PptTheme } | null> {
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
    return {
      id: targetId,
      name: parsed.doc.name,
      slideCount: parsed.doc.slide.length,
      theme: parsed.doc.theme
    }
  }

  /**
   * 读取指定页元素树（ppt_get_nodes 工具）：完整 SlideNode 数组（含顶层 id）+ theme。
   * ids 给定时只返回命中节点（保留祖先结构），供 AI 聚焦少量元素后再精准编辑。
   */
  async getNodes(
    id: string | undefined,
    slideId: number,
    ids?: string[]
  ): Promise<{ error: string } | { nodes: SlideNode[]; theme: PptTheme } | null> {
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
    if (!Number.isInteger(slideId) || slideId < 1 || slideId > json.slide.length) {
      return { error: `页码越界：${slideId}（当前共 ${json.slide.length} 页，从 1 开始）` }
    }
    const page = json.slide[slideId - 1]
    ensureNodeIds(page)
    const nodes = ids?.length ? filterNodesByIds(page, ids) : page
    return { nodes, theme: json.theme }
  }

  /**
   * 创建新 PPT：指定文件名（id）+ Theme 令牌 + 初始页数（slide 数组放 slideCount 个空页，缺省 1）。
   * 重名报错（不覆盖，AI 换名或先删除旧文件）。
   */
  async create(input: {
    name: string
    theme?: PptTheme
    slideCount?: number
  }): Promise<{ error: string } | { success: true; id: string; path: string }> {
    const name = input.name?.trim()
    if (!name) return { error: 'name 不能为空：请为 PPT 指定文件名（如「产品发布会」）' }
    if (!/^[A-Za-z0-9\u4e00-\u9fa5_-]{1,60}$/.test(name)) {
      return { error: `文件名「${name}」非法：1-60 字符，仅允许中文 / 字母 / 数字 / _ / -` }
    }
    const themeErrors = validatePptTheme(input.theme ?? {})
    if (themeErrors.length) return { error: themeErrors.join('；') }
    const slideCount = Math.max(1, Math.floor(input.slideCount ?? 1))
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
      slide: Array.from({ length: slideCount }, () => [])
    }
    const doc: PptCurrentDoc = { id: name, name: buildPptFileName(name), json }
    await this.persist(doc)
    this.current.value = doc
    this.currentPage.value = 1
    await this.refreshFiles()
    return { success: true, id: name, path: doc.name }
  }

  /** 新增一页（空页）到文件末尾（ppt_add_slide 工具），返回 1 起始页索引与总页数 */
  async addSlide(id: string | undefined): Promise<PptPageResult> {
    return this.withPages(id, (slide) => {
      slide.push([])
      return { success: true, slideId: slide.length, total: slide.length }
    })
  }

  /** 删除指定页（ppt_delete_slide 工具）：页码越界报错；删除后 currentPage 收敛到有效范围 */
  async deleteSlide(id: string | undefined, slideId: number): Promise<PptPageResult> {
    return this.withPages(id, (slide) => {
      if (!Number.isInteger(slideId) || slideId < 1 || slideId > slide.length) {
        return { error: `页码越界：${slideId}（当前共 ${slide.length} 页，从 1 开始）` }
      }
      slide.splice(slideId - 1, 1)
      if (this.currentPage.value > slide.length) this.currentPage.value = Math.max(1, slide.length)
      return { success: true, slideId: Math.min(slideId, slide.length), total: slide.length }
    })
  }

  /**
   * 批量编辑指定页元素（ppt_batch_edit 工具）：5 种 op（insert / copy / update / move / delete）
   * 顺序执行，单操作非法只让该操作失败（错误写入 results），其余照常执行并整体落盘（仿 canvas）。
   * 每批 ≤ 15 个操作（工具层 / schema 已拦截，此处兜底）。
   */
  async batchEdit(
    id: string | undefined,
    slideId: number,
    ops: unknown[]
  ): Promise<PptBatchEditResult> {
    return this.withPages(id, (slide) => {
      if (!Number.isInteger(slideId) || slideId < 1 || slideId > slide.length) {
        return { error: `页码越界：${slideId}（当前共 ${slide.length} 页，从 1 开始）` }
      }
      if (!Array.isArray(ops) || ops.length === 0) {
        return { error: 'operations 不能为空：至少 1 个操作' }
      }
      if (ops.length > 15) {
        return {
          error: 'operations 超过上限：每批最多 15 个操作（元素过多 AI 生成的 JSON 容易出错，请分批处理）'
        }
      }
      const { results, potentialIssues } = executePptBatchOps(slide[slideId - 1], ops)
      return { success: true, slideId, total: slide.length, results, potentialIssues }
    })
  }

  /** 更新全局主题色板（ppt_set_theme 工具）：校验 token 后整体替换 theme，$token 引用联动换肤 */
  async setTheme(
    id: string | undefined,
    theme: PptTheme
  ): Promise<{ error: string } | { success: true; id: string }> {
    const themeErrors = validatePptTheme(theme)
    if (themeErrors.length) return { error: themeErrors.join('；') }
    const doc = this.current.value
    const targetId = id ?? doc?.id
    if (!targetId) return { error: '未指定 PPT，且当前没有打开的 PPT（先 ppt_create 或 ppt_open）' }
    const path = window.preload.path.join(
      buildPptOutputsDir(this.sandboxDir),
      buildPptFileName(targetId)
    )
    if (!window.preload.fs.existsSync(path)) return { error: `未找到 PPT「${targetId}」` }
    let text: string
    try {
      text = await window.preload.fs.readTextFile(path)
    } catch (err) {
      return { error: `读取失败：${errorText(err)}` }
    }
    const parsed = parseDoc(text)
    if ('error' in parsed) return parsed
    const json = parsed.doc
    json.theme = theme
    json.updatedAt = Date.now()
    try {
      await this.persist({ id: targetId, name: buildPptFileName(targetId), json })
      if (this.current.value?.id === targetId) {
        this.current.value = { id: targetId, name: buildPptFileName(targetId), json }
      }
    } catch (err) {
      return { error: `写入失败：${errorText(err)}` }
    }
    return { success: true, id: targetId }
  }

  /** 删除指定 PPT 文件（删除的是当前文档时清空当前态） */
  async delete(id: string): Promise<void> {
    const path = window.preload.path.join(buildPptOutputsDir(this.sandboxDir), buildPptFileName(id))
    if (window.preload.fs.existsSync(path)) {
      await window.preload.fs.rm(path)
    }
    if (this.current.value?.id === id) {
      this.current.value = null
      this.currentPage.value = 1
    }
    await this.refreshFiles()
  }

  /** 定位到指定页（渲染器联动跳转；越界给错误反馈，AI 自纠） */
  selectPage(page: number): { error: string } | { success: true } {
    const total = this.current.value?.json.slide.length ?? 0
    if (page < 1) return { error: `页码越界：${page}（页码从 1 开始）` }
    if (total > 0 && page > total) {
      return { error: `页码越界：${page}（当前共 ${total} 页）` }
    }
    this.currentPage.value = page
    return { success: true }
  }

  // ─── 内部：页面读写（读文件 → 校验元素 → 应用 → JSON 写回） ──

  /**
   * 页面操作公共链路：打开文件（pptId 缺省当前）→ JSON 解析 → 应用操作 →
   * JSON 写回（原地更新，不产生新版本）；操作抛错则整体拒绝。
   */
  private async withPages<T extends PptPageResult>(
    id: string | undefined,
    apply: (slide: SlideNode[][]) => T
  ): Promise<T> {
    const doc = this.current.value
    const targetId = id ?? doc?.id
    if (!targetId)
      return { error: '未指定 PPT，且当前没有打开的 PPT（先 ppt_create 或 ppt_open）' } as T
    const path = window.preload.path.join(
      buildPptOutputsDir(this.sandboxDir),
      buildPptFileName(targetId)
    )
    if (!window.preload.fs.existsSync(path)) {
      return { error: `未找到 PPT「${targetId}」` } as T
    }
    let text: string
    try {
      text = await window.preload.fs.readTextFile(path)
    } catch (err) {
      return { error: `读取失败：${errorText(err)}` } as T
    }
    const parsed = parseDoc(text)
    if ('error' in parsed) return parsed as T
    const json = parsed.doc
    let result: T
    try {
      result = apply(json.slide)
    } catch (err) {
      return { error: errorText(err) } as T
    }
    if ('error' in result) return result
    // 写回前为全部页面补齐节点 id（新元素 / AI 手写文件统一），并把受影响页节点摘要返回给 AI 引用
    json.slide.forEach(ensureNodeIds)
    if (result.slideId >= 1 && result.slideId <= json.slide.length) {
      const enriched = result as PptPageResult & { nodes?: PptNodeInfo[] }
      enriched.nodes = collectPageNodes(json.slide[result.slideId - 1])
    }
    json.updatedAt = Date.now()
    try {
      await this.persist({ id: targetId, name: buildPptFileName(targetId), json })
      if (this.current.value?.id === targetId) {
        // 原地更新当前文档（对象替换驱动 vueRender 响应式重渲染）
        this.current.value = { id: targetId, name: buildPptFileName(targetId), json }
      }
    } catch (err) {
      return { error: `写入失败：${errorText(err)}` } as T
    }
    return result
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
