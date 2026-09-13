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

/** 初稿版本（读时归一化与创建共用，保证幂等） */
const buildBaseVersion = (articleId: string, file: string): ArticleVersion => ({
  id: `${articleId}-base`,
  file,
  source: 'original',
  createdTime: Date.now()
})

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
   */
  async refresh(): Promise<ArticleProject> {
    const path = buildProjectPath(this.root)
    if (window.preload.fs.existsSync(path)) {
      try {
        const parsed = JSON.parse(await window.preload.fs.readTextFile(path)) as ArticleProject
        if (parsed && Array.isArray(parsed.articles)) {
          if (this.normalizeProject(parsed)) await this.persist(parsed)
          this.project.value = parsed
          return parsed
        }
      } catch {
        // 解析失败（损坏 / 旧格式）落到重建
      }
    }
    const project = emptyProject()
    this.project.value = project
    await this.persist(project)
    return project
  }

  /**
   * 读时归一化。返回是否有变化：
   * - 旧结构（无 types 数组，schema=1）不迁移：保留标题/摘要/提纲，types 置空由 AI 重建，遗留字段序列化时剔除
   * - 每个类型条目：无版本合成 V1 原稿；激活版本失效回落最后一个；file 恒同步激活版本
   */
  private normalizeProject(project: ArticleProject): boolean {
    let dirty = false
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
          entry.versions = [buildBaseVersion(item.id, entry.file)]
          entry.activeVersionId = entry.versions[0].id
          dirty = true
        }
        const versions = entry.versions
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
    return {
      type,
      file,
      versions: [buildBaseVersion(item.id, file)],
      activeVersionId: `${item.id}-base`
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

  /** 新增文章：创建首个类型条目（缺省「其他」）与正文 md 文件并登记到索引 */
  async createArticle(input: ArticleCreateInput): Promise<ArticleItem> {
    const project = await this.refresh()
    const id = nanoid(8)
    const item: ArticleItem = {
      id,
      title: input.title,
      summary: input.summary,
      outline: input.outline,
      types: []
    }
    const entry = this.buildEntry(item, normalizeType(input.type))
    item.types.push(entry)
    const filePath = window.preload.path.join(this.root, entry.file)
    await window.preload.fs.mkdir(window.preload.path.dirname(filePath), true)
    await window.preload.fs.writeTextFile(filePath, `# ${input.title}\n`)
    project.articles.push(item)
    await this.persist(project)
    return item
  }

  /** 更新文章级信息（标题 / 摘要 / 提纲） */
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

  /** 删除文章：移除登记并删除全部类型的全部版本正文 md 文件（若存在） */
  async removeArticle(id: string): Promise<void> {
    const project = await this.refresh()
    const index = project.articles.findIndex((a) => a.id === id)
    if (index < 0) throw new Error(`未找到文章 ${id}，可用 article_list 获取 id`)
    const [removed] = project.articles.splice(index, 1)
    await this.persist(project)
    if (removed) {
      const files = new Set(removed.types.flatMap((t) => t.versions?.map((v) => v.file) ?? []))
      for (const file of files) {
        const filePath = window.preload.path.join(this.root, file)
        if (window.preload.fs.existsSync(filePath)) {
          await window.preload.fs.rm(filePath)
        }
      }
    }
  }

  /** 读取指定类型当前激活版本的正文（markdown 文本） */
  async readArticle(id: string, typeInput: string): Promise<string> {
    const project = await this.refresh()
    const entry = this.requireEntry(project, id, normalizeType(typeInput))
    const filePath = window.preload.path.join(this.root, entry.file)
    if (!(window.preload.fs.existsSync(filePath))) {
      throw new Error(`文章正文文件不存在：${filePath}`)
    }
    return window.preload.fs.readTextFile(filePath)
  }

  /** 统计指定类型正文字数（去空白字符数），回写 entry.words 并落盘 */
  async countWords(id: string, typeInput: string): Promise<number> {
    const project = await this.refresh()
    const type = normalizeType(typeInput)
    const entry = this.requireEntry(project, id, type)
    const text = await this.readArticle(id, type)
    const words = countChars(text)
    entry.words = words
    await this.persist(project)
    return words
  }

  /**
   * 写入正文（AI 主通道 article_write）：默认覆盖激活版本文件；asNewVersion=true 时
   * 另存为 rewrite 新版本。类型不存在自动创建。完成后 bump 内容版本号，驱动侧边栏即时重读。
   */
  async writeContent(
    id: string,
    typeInput: string,
    content: string,
    asNewVersion = false
  ): Promise<{ type: string; file: string; versionId: string; words: number }> {
    const project = await this.refresh()
    const entry = this.ensureEntry(project, id, typeInput)
    const words = countChars(content)
    if (asNewVersion) {
      const version = await this.createVersion(id, entry.type, { source: 'rewrite', content })
      this.bumpContentRev(id, entry.type)
      return { type: entry.type, file: version.file, versionId: version.id, words }
    }
    const version = entry.versions?.find((v) => v.id === entry.activeVersionId)
    const filePath = window.preload.path.join(this.root, entry.file)
    await window.preload.fs.mkdir(window.preload.path.dirname(filePath), true)
    await window.preload.fs.writeTextFile(filePath, content)
    if (version) version.words = words
    entry.words = words
    await this.persist(project)
    this.bumpContentRev(id, entry.type)
    return { type: entry.type, file: entry.file, versionId: version?.id ?? '', words }
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
