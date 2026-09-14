import { nanoid } from 'nanoid'
import type {
  ArticleCreateInput,
  ArticleItem,
  ArticleProject,
  ArticleTypeEntry,
  ArticleTypePatch,
  ArticleUpdatePatch,
  ArticleVersion,
  ArticleVersionSource
} from './articleTypes'

/** 项目管理索引文件名 */
const PROJECT_FILE = 'project.json'

/** 文章项目根目录：有工作空间优先用工作空间，否则退回沙盒 outputs/ */
export const buildArticleRoot = (workspace: string, sandboxDir: string): string => {
  const base = workspace || window.preload.path.join(sandboxDir, 'outputs')
  return window.preload.path.join(base, 'articles')
}

/** 项目索引文件路径 */
const buildProjectPath = (root: string): string => window.preload.path.join(root, PROJECT_FILE)

/** 初稿版本（读时归一化与创建共用，保证幂等）；版本 id 全局唯一，即「标题+类型+版本」单元标识 */
const buildBaseVersion = (file: string): ArticleVersion => ({
  id: nanoid(8),
  no: 1,
  file,
  source: 'original',
  createdTime: Date.now()
})

/** 下一个版本号：取现有最大 no + 1（存量数据缺 no 时按 0 兜底） */
const nextVersionNo = (versions: ArticleVersion[]): number =>
  versions.reduce((max, v) => Math.max(max, v.no ?? 0), 0) + 1

const emptyProject = (title?: string): ArticleProject => ({
  schema: 2,
  title: title ?? '',
  updatedTime: Date.now(),
  articles: []
})

const countChars = (text: string): number => text.replace(/\s+/g, '').length

/** 类型名归一：去除首尾空白，空值回落「其他」（类型由 AI 自由命名，不做白名单限制） */
const normalizeType = (type: unknown): string => {
  const name = typeof type === 'string' ? type.trim() : ''
  return name || '其他'
}

/**
 * 文章项目管理 store（按 root 键控的全局单例）：
   * - 工具与侧边栏共享同一响应式实例：AI 变更实时驱动 UI
   * - 全部正文 / 版本读写按 (id, type) 作用（一篇文章 × 多平台类型）
 * - 每次变更自动落盘 project.json，重启聊天可恢复
 * root 为 articles/ 目录绝对路径（见 buildArticleRoot）。
 */
export class ArticleStore {
  /** 当前项目管理索引（deep reactive） */
  readonly project = ref<ArticleProject | null>(null)

  /**
   * 正文内容版本号（内存态，不落盘）：AI 经 writeContent 写入后按 `${id}::${type}` 递增，
   * 侧边栏 watch 该值即时重读正文，实现「AI 写完 → 侧边栏自动呈现」。
   */
  readonly contentRevs = reactive(new Map<string, number>())

  constructor(readonly root: string) {}

  private bumpContentRev(id: string, type: string): void {
    const key = `${id}::${type}`
    this.contentRevs.set(key, (this.contentRevs.get(key) ?? 0) + 1)
  }

  /**
   * 刷新项目索引：project.json 不存在时自动创建空项目并落盘（幂等）。
   * 侧边栏挂载 / 工具首次调用时执行。
   *
   * ⚠️ 返回 `this.project.value`（reactive 代理）而非磁盘解析出的 raw 对象：本类写方法都是
   * 「refresh() → 就地改 → persist」模式，拿到 raw 时 `Object.assign(entry, patch)` 只落在
   * raw target 上、不触发响应式，侧边栏读到的仍是旧值（封面 / 配图不刷新，需重开页面）。
   */
  async refresh(): Promise<ArticleProject> {
    const path = buildProjectPath(this.root)
    if (window.preload.fs.existsSync(path)) {
      try {
        const parsed = JSON.parse(await window.preload.fs.readTextFile(path)) as ArticleProject
        if (parsed && Array.isArray(parsed.articles)) {
          if (this.normalizeProject(parsed)) await this.persist(parsed)
          this.project.value = parsed
          return this.project.value
        }
      } catch {
        // 解析失败（损坏 / 旧格式）落到重建
      }
    }
    const project = emptyProject()
    this.project.value = project
    await this.persist(project)
    return this.project.value
  }

  /**
   * 读时归一化。返回是否有变化：
   * - 旧结构（无 types 数组，schema=1）不迁移：保留标题/摘要/提纲，types 置空由 AI 重建，遗留字段序列化时剔除
   * - 每个类型条目：无版本合成 V1 原稿；激活版本失效回落最后一个；file 恒同步激活版本
   * - 版本号 no 缺失按索引补齐；版本 id 全局去重（旧数据 `${articleId}-base` 跨类型撞 id，重发 nanoid 并同步激活引用）
   */
  private normalizeProject(project: ArticleProject): boolean {
    let dirty = false
    const seenVersionIds = new Set<string>()
    for (const item of project.articles) {
      if (!Array.isArray(item.types)) {
        const legacy = item as unknown as ArticleItem & Record<string, unknown>
        item.title = legacy.title
        item.summary = legacy.summary
        item.outline = legacy.outline
        item.types = []
        dirty = true
      }
      for (const entry of item.types) {
        // 旧数据遗留的 status 字段已废弃，序列化前剔除
        if ('status' in entry) {
          delete (entry as ArticleTypeEntry & Record<string, unknown>).status
          dirty = true
        }
        if (!entry.versions || entry.versions.length === 0) {
          entry.versions = [buildBaseVersion(entry.file)]
          entry.activeVersionId = entry.versions[0].id
          dirty = true
        }
        const versions = entry.versions
        versions.forEach((v, i) => {
          if (!Number.isInteger(v.no) || (v.no ?? 0) < 1) {
            v.no = i + 1
            dirty = true
          }
          if (seenVersionIds.has(v.id)) {
            const newId = nanoid(8)
            if (entry.activeVersionId === v.id) entry.activeVersionId = newId
            v.id = newId
            dirty = true
          }
          seenVersionIds.add(v.id)
        })
        const active = versions.find((v) => v.id === entry.activeVersionId) ?? versions[versions.length - 1]
        if (entry.activeVersionId !== active.id) {
          entry.activeVersionId = active.id
          dirty = true
        }
        if (entry.file !== active.file) {
          entry.file = active.file
          dirty = true
        }
      }
    }
    return dirty
  }

  /** 按 id 取文章条目，不存在即抛错（与 AI 工具的错误提示保持一致） */
  private requireArticle(project: ArticleProject, id: string): ArticleItem {
    const item = project.articles.find((a) => a.id === id)
    if (!item) throw new Error(`未找到文章 ${id}，可用 article_list 获取 id`)
    return item
  }

  /** 取类型条目（严格模式：不存在即抛错） */
  private requireEntry(project: ArticleProject, id: string, type: string): ArticleTypeEntry {
    const item = this.requireArticle(project, id)
    const entry = item.types.find((t) => t.type === type)
    if (!entry) throw new Error(`文章《${item.title}》尚无「${type}」类型，可用 article_update 创建`)
    return entry
  }

  /** 按版本 id 解析「标题+类型+版本」单元（工具面 article_write / read / stats 的唯一寻址方式） */
  private resolveVersion(
    project: ArticleProject,
    id: string
  ): { article: ArticleItem; entry: ArticleTypeEntry; version: ArticleVersion } {
    for (const article of project.articles) {
      for (const entry of article.types) {
        const version = entry.versions?.find((v) => v.id === id)
        if (version) return { article, entry, version }
      }
    }
    throw new Error(`未找到文章单元 ${id}，可用 article_list 获取 id`)
  }

  /** 取或创建类型条目（写入路径：类型不存在自动创建空草稿） */
  private ensureEntry(project: ArticleProject, id: string, typeInput: unknown): ArticleTypeEntry {
    const item = this.requireArticle(project, id)
    const type = normalizeType(typeInput)
    let entry = item.types.find((t) => t.type === type)
    if (!entry) {
      entry = this.buildEntry(item, type)
      item.types.push(entry)
    }
    return entry
  }

  /** 构建空草稿类型条目（新正文文件 + V1 原稿版本；文件内容由调用方写入） */
  private buildEntry(item: ArticleItem, type: string): ArticleTypeEntry {
    const file = `drafts/${item.id}-${nanoid(6)}.md`
    const version = buildBaseVersion(file)
    return {
      type,
      file,
      versions: [version],
      activeVersionId: version.id
    }
  }

  /** 初始化 / 重命名项目标题 */
  async init(title?: string): Promise<ArticleProject> {
    const project = await this.refresh()
    if (title) {
      project.title = title
      await this.persist(project)
    }
    return project
  }

  /** 文章列表（按创建顺序） */
  listArticles(): ArticleItem[] {
    return this.project.value?.articles ?? []
  }

  /**
   * 创建「标题+类型+版本」单元（article_create 主通道）：
   * - 按标题找/建文章（标题=主题标识），按类型找/建条目（缺省「其他」）
   * - 版本号缺省自动：新条目=1，已有条目=最新版本号+1；同号已存在 → 幂等复用返回已有单元 id
   * - 新建版本时创建正文 md 文件（初始内容 `# 标题`）并设为激活版本
   */
  async createArticle(
    input: ArticleCreateInput
  ): Promise<{ id: string; title: string; type: string; version: number }> {
    const project = await this.refresh()
    let item = project.articles.find((a) => a.title === input.title)
    if (!item) {
      item = { id: nanoid(8), title: input.title, summary: input.summary, outline: input.outline, types: [] }
      project.articles.push(item)
    } else if (input.summary !== undefined || input.outline !== undefined) {
      if (input.summary !== undefined) item.summary = input.summary
      if (input.outline !== undefined) item.outline = input.outline
    }
    const type = normalizeType(input.type)
    let entry = item.types.find((t) => t.type === type)
    const entryCreated = !entry
    if (!entry) {
      entry = this.buildEntry(item, type)
      item.types.push(entry)
    }
    const versions = entry.versions ?? []
    const no =
      Number.isInteger(input.version) && (input.version ?? 0) >= 1
        ? (input.version as number)
        : entryCreated
          ? 1
          : nextVersionNo(versions)
    const existing = versions.find((v) => v.no === no)
    if (existing) {
      await this.persist(project)
      return { id: existing.id, title: item.title, type, version: no }
    }
    const version: ArticleVersion = {
      id: nanoid(8),
      no,
      file: `drafts/${item.id}-${nanoid(6)}.md`,
      source: 'original',
      createdTime: Date.now()
    }
    entry.versions = [...versions, version]
    entry.activeVersionId = version.id
    entry.file = version.file
    const filePath = window.preload.path.join(this.root, version.file)
    await window.preload.fs.mkdir(window.preload.path.dirname(filePath), true)
    await window.preload.fs.writeTextFile(filePath, `# ${input.title}\n`)
    await this.persist(project)
    return { id: version.id, title: item.title, type, version: no }
  }

  /**
   * 按单元（版本 id）更新信息（article_update 主通道）：
   * title / summary / outline 作用于所属文章，cover / images 作用于所属类型。
   */
  async updateUnit(
    id: string,
    patch: ArticleUpdatePatch & ArticleTypePatch
  ): Promise<Record<string, unknown>> {
    const project = await this.refresh()
    const { article, entry } = this.resolveVersion(project, id)
    const articlePatch: ArticleUpdatePatch = {}
    if (patch.title !== undefined) articlePatch.title = patch.title
    if (patch.summary !== undefined) articlePatch.summary = patch.summary
    if (patch.outline !== undefined) articlePatch.outline = patch.outline
    Object.assign(article, articlePatch)
    const typePatch: ArticleTypePatch = {}
    if (patch.cover !== undefined) typePatch.cover = patch.cover
    if (patch.images !== undefined) typePatch.images = patch.images
    Object.assign(entry, typePatch)
    await this.persist(project)
    return { ...articlePatch, ...typePatch }
  }

  /**
   * 更新文章级信息（标题 / 摘要 / 提纲；按文章 id 寻址）。
   * 侧边栏标题编辑走这里：无类型的旧文章没有版本单元，不能经 updateUnit 寻址。
   */
  async updateArticle(id: string, patch: ArticleUpdatePatch): Promise<ArticleItem> {
    const project = await this.refresh()
    const item = this.requireArticle(project, id)
    Object.assign(item, patch)
    await this.persist(project)
    return item
  }

  /** 更新类型级信息（封面 / 配图；类型不存在自动创建） */
  async updateType(id: string, typeInput: string, patch: ArticleTypePatch): Promise<ArticleTypeEntry> {
    const project = await this.refresh()
    const entry = this.ensureEntry(project, id, typeInput)
    Object.assign(entry, patch)
    await this.persist(project)
    return entry
  }

  /** 删除单元（版本 id）所属整篇文章：移除登记并删除其全部类型的全部版本正文 md 文件（若存在） */
  async removeArticle(id: string): Promise<void> {
    const project = await this.refresh()
    const { article } = this.resolveVersion(project, id)
    const index = project.articles.indexOf(article)
    project.articles.splice(index, 1)
    await this.persist(project)
    const files = new Set(article.types.flatMap((t) => t.versions?.map((v) => v.file) ?? []))
    for (const file of files) {
      const filePath = window.preload.path.join(this.root, file)
      if (window.preload.fs.existsSync(filePath)) {
        await window.preload.fs.rm(filePath)
      }
    }
  }

  /** 读取指定单元（版本 id）的正文（markdown 文本） */
  async readArticle(id: string): Promise<string> {
    const project = await this.refresh()
    const { version } = this.resolveVersion(project, id)
    const filePath = window.preload.path.join(this.root, version.file)
    if (!(window.preload.fs.existsSync(filePath))) {
      throw new Error(`文章正文文件不存在：${filePath}`)
    }
    return window.preload.fs.readTextFile(filePath)
  }

  /** 统计指定单元（版本 id）正文字数（去空白字符数），回写 version.words 并落盘 */
  async countWords(id: string): Promise<number> {
    const project = await this.refresh()
    const { entry, version } = this.resolveVersion(project, id)
    const text = await this.readArticle(id)
    const words = countChars(text)
    version.words = words
    if (entry.activeVersionId === version.id) entry.words = words
    await this.persist(project)
    return words
  }

  /**
   * 写入正文（AI 主通道 article_write）：id 为「标题+类型+版本」单元（版本 id）。
   * 默认覆盖该版本文件；asNewVersion=true 时在所属类型下另存 rewrite 新版本（返回新 id，后续写入用新 id）。
   * 写入后该版本设为激活版本并 bump 内容版本号，驱动侧边栏即时呈现。
   */
  async writeContent(
    id: string,
    content: string,
    asNewVersion = false
  ): Promise<{ id: string; version: number; file: string; words: number }> {
    const project = await this.refresh()
    const { article, entry, version } = this.resolveVersion(project, id)
    const words = countChars(content)
    if (asNewVersion) {
      const next = await this.createVersion(article.id, entry.type, { source: 'rewrite', content })
      this.bumpContentRev(article.id, entry.type)
      return { id: next.id, version: next.no, file: next.file, words }
    }
    const filePath = window.preload.path.join(this.root, version.file)
    await window.preload.fs.mkdir(window.preload.path.dirname(filePath), true)
    await window.preload.fs.writeTextFile(filePath, content)
    version.words = words
    if (entry.activeVersionId !== version.id) {
      entry.activeVersionId = version.id
      entry.file = version.file
    }
    if (entry.activeVersionId === version.id) entry.words = words
    await this.persist(project)
    this.bumpContentRev(article.id, entry.type)
    return { id: version.id, version: version.no, file: version.file, words }
  }

  /** 新建版本：写入新正文文件并登记为激活版本（每次去 AI 味 / 重写等迭代产生新版本，原版本内容不动） */
  async createVersion(
    id: string,
    typeInput: string,
    input: { source: ArticleVersionSource; content: string; label?: string }
  ): Promise<ArticleVersion> {
    const project = await this.refresh()
    const type = normalizeType(typeInput)
    const entry = this.requireEntry(project, id, type)
    const file = `drafts/${id}-${nanoid(6)}.md`
    const filePath = window.preload.path.join(this.root, file)
    await window.preload.fs.mkdir(window.preload.path.dirname(filePath), true)
    await window.preload.fs.writeTextFile(filePath, input.content)
    const version: ArticleVersion = {
      id: nanoid(8),
      no: nextVersionNo(entry.versions ?? []),
      file,
      source: input.source,
      label: input.label,
      createdTime: Date.now(),
      words: countChars(input.content)
    }
    entry.versions = [...(entry.versions ?? []), version]
    entry.activeVersionId = version.id
    entry.file = version.file
    await this.persist(project)
    return version
  }

  /** 切换指定类型的激活版本（entry.file 同步指向该版本，AI 工具读写随激活版本走） */
  async switchVersion(id: string, typeInput: string, versionId: string): Promise<ArticleVersion> {
    const project = await this.refresh()
    const type = normalizeType(typeInput)
    const entry = this.requireEntry(project, id, type)
    const version = entry.versions?.find((v) => v.id === versionId)
    if (!version) throw new Error(`未找到版本 ${versionId}`)
    entry.activeVersionId = version.id
    entry.file = version.file
    await this.persist(project)
    return version
  }

  /** 删除版本：至少保留一个；删除的是激活版本时回落到最后一个版本 */
  async removeVersion(id: string, typeInput: string, versionId: string): Promise<void> {
    const project = await this.refresh()
    const type = normalizeType(typeInput)
    const entry = this.requireEntry(project, id, type)
    const versions = entry.versions ?? []
    if (versions.length <= 1) throw new Error('至少保留一个版本')
    const index = versions.findIndex((v) => v.id === versionId)
    if (index < 0) throw new Error(`未找到版本 ${versionId}`)
    const [removed] = versions.splice(index, 1)
    if (entry.activeVersionId === versionId) {
      const next = versions[versions.length - 1]
      entry.activeVersionId = next.id
      entry.file = next.file
    }
    await this.persist(project)
    if (removed) {
      const filePath = window.preload.path.join(this.root, removed.file)
      if (window.preload.fs.existsSync(filePath)) {
        await window.preload.fs.rm(filePath)
      }
    }
  }

  /** 更新版本信息（字数 / 自定义名） */
  async patchVersion(
    id: string,
    typeInput: string,
    versionId: string,
    patch: Partial<Pick<ArticleVersion, 'label' | 'words'>>
  ): Promise<ArticleVersion> {
    const project = await this.refresh()
    const type = normalizeType(typeInput)
    const entry = this.requireEntry(project, id, type)
    const version = entry.versions?.find((v) => v.id === versionId)
    if (!version) throw new Error(`未找到版本 ${versionId}`)
    Object.assign(version, patch)
    await this.persist(project)
    return version
  }

  private async persist(project: ArticleProject): Promise<void> {
    project.updatedTime = Date.now()
    if (!(window.preload.fs.existsSync(this.root))) {
      await window.preload.fs.mkdir(this.root, true)
    }
    await window.preload.fs.writeTextFile(buildProjectPath(this.root), JSON.stringify(project))
  }
}

const stores = new Map<string, ArticleStore>()

/** 获取指定 root 的文章 store（存在即复用，跨组件与工具共享同一响应式实例） */
export const getArticleStore = (root: string): ArticleStore => {
  let store = stores.get(root)
  if (!store) {
    store = new ArticleStore(root)
    stores.set(root, store)
  }
  return store
}

/** 销毁指定 root 的文章 store（释放内存；root 变化时由调用方调用） */
export const destroyArticleStore = (root: string): void => {
  stores.delete(root)
}
