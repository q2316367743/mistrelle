import { nanoid } from 'nanoid'
import type {
  ArticleCreateInput,
  ArticleItem,
  ArticleProject,
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

/** 正文文件路径（drafts/{id}.md） */
export const buildArticleFilePath = (root: string, id: string): string =>
  window.preload.path.join(root, 'drafts', `${id}.md`)

/** 初稿版本 id（确定性，读时归一化与创建共用，保证幂等） */
const baseVersionId = (articleId: string): string => `${articleId}-base`

/** 初稿版本（存量无版本文章自动合成 V1） */
const buildBaseVersion = (articleId: string, file: string): ArticleVersion => ({
  id: baseVersionId(articleId),
  file,
  source: 'original',
  createdTime: Date.now()
})

const emptyProject = (title?: string): ArticleProject => ({
  schema: 1,
  title: title ?? '',
  updatedTime: Date.now(),
  articles: []
})

const countChars = (text: string): number => text.replace(/\s+/g, '').length

/**
 * 文章项目管理 store（按 root 键控的全局单例）：
 * - 工具与侧边栏共享同一响应式实例：AI 变更实时驱动 UI
 * - 每次变更自动落盘 project.json，重启聊天可恢复
 * root 为 articles/ 目录绝对路径（见 buildArticleRoot）。
 */
export class ArticleStore {
  /** 当前项目管理索引（deep reactive） */
  readonly project = ref<ArticleProject | null>(null)

  constructor(private readonly root: string) {}

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
          // 读时归一化：存量文章补版本列表（仅真正变化时落盘一次，保证迁移后时间戳稳定）
          if (this.normalizeVersions(parsed)) await this.persist(parsed)
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

  /** 读时归一化：无版本的存量文章合成 V1 原稿；激活版本失效时回落到最后一个；file 恒同步激活版本。返回是否有变化 */
  private normalizeVersions(project: ArticleProject): boolean {
    let dirty = false
    for (const item of project.articles) {
      if (!item.versions || item.versions.length === 0) {
        item.versions = [buildBaseVersion(item.id, item.file)]
        item.activeVersionId = item.versions[0].id
        dirty = true
      }
      const versions = item.versions
      const active = versions.find((v) => v.id === item.activeVersionId) ?? versions[versions.length - 1]
      if (item.activeVersionId !== active.id) {
        item.activeVersionId = active.id
        dirty = true
      }
      if (item.file !== active.file) {
        item.file = active.file
        dirty = true
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

  /** 新增文章：创建正文 md 文件并登记到索引（自带 V1 原稿版本） */
  async createArticle(input: ArticleCreateInput): Promise<ArticleItem> {
    const project = await this.refresh()
    const id = nanoid(8)
    const file = `drafts/${id}.md`
    const base = buildBaseVersion(id, file)
    const item: ArticleItem = {
      id,
      title: input.title,
      platform: input.platform,
      status: 'draft',
      file,
      summary: input.summary,
      outline: input.outline,
      versions: [base],
      activeVersionId: base.id
    }
    const filePath = buildArticleFilePath(this.root, id)
    await window.preload.fs.mkdir(window.preload.path.dirname(filePath), true)
    await window.preload.fs.writeTextFile(filePath, `# ${input.title}\n`)
    project.articles.push(item)
    await this.persist(project)
    return item
  }

  /** 更新文章元信息（白名单字段） */
  async updateArticle(id: string, patch: ArticleUpdatePatch): Promise<ArticleItem> {
    const project = await this.refresh()
    const item = project.articles.find((a) => a.id === id)
    if (!item) throw new Error(`未找到文章 ${id}，可用 article_list 获取 id`)
    Object.assign(item, patch)
    await this.persist(project)
    return item
  }

  /** 删除文章：移除登记并删除全部版本正文 md 文件（若存在） */
  async removeArticle(id: string): Promise<void> {
    const project = await this.refresh()
    const index = project.articles.findIndex((a) => a.id === id)
    if (index < 0) throw new Error(`未找到文章 ${id}，可用 article_list 获取 id`)
    const [removed] = project.articles.splice(index, 1)
    await this.persist(project)
    if (removed) {
      const files = new Set([...(removed.versions?.map((v) => v.file) ?? []), removed.file])
      for (const file of files) {
        const filePath = window.preload.path.join(this.root, file)
        if (window.preload.fs.existsSync(filePath)) {
          await window.preload.fs.rm(filePath)
        }
      }
    }
  }

  /** 读取文章正文（markdown 文本） */
  async readArticle(id: string): Promise<string> {
    const project = await this.refresh()
    const item = project.articles.find((a) => a.id === id)
    if (!item) throw new Error(`未找到文章 ${id}，可用 article_list 获取 id`)
    const filePath = window.preload.path.join(this.root, item.file)
    if (!(window.preload.fs.existsSync(filePath))) {
      throw new Error(`文章正文文件不存在：${filePath}`)
    }
    return window.preload.fs.readTextFile(filePath)
  }

  /** 统计文章字数（去空白字符数），回写 item.words 并落盘 */
  async countWords(id: string): Promise<number> {
    const project = await this.refresh()
    const item = this.requireArticle(project, id)
    const text = await this.readArticle(id)
    const words = countChars(text)
    item.words = words
    await this.persist(project)
    return words
  }

  /** 新建版本：写入新正文文件并登记为激活版本（每次去 AI 味等迭代产生新版本，原版本内容不动） */
  async createVersion(
    id: string,
    input: { source: ArticleVersionSource; content: string; label?: string }
  ): Promise<ArticleVersion> {
    const project = await this.refresh()
    const item = this.requireArticle(project, id)
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
    item.versions = [...(item.versions ?? []), version]
    item.activeVersionId = version.id
    item.file = version.file
    await this.persist(project)
    return version
  }

  /** 切换激活版本（item.file 同步指向该版本，AI 工具读写与导出随激活版本走） */
  async switchVersion(id: string, versionId: string): Promise<ArticleVersion> {
    const project = await this.refresh()
    const item = this.requireArticle(project, id)
    const version = item.versions?.find((v) => v.id === versionId)
    if (!version) throw new Error(`未找到版本 ${versionId}`)
    item.activeVersionId = version.id
    item.file = version.file
    await this.persist(project)
    return version
  }

  /** 删除版本：至少保留一个；删除的是激活版本时回落到最后一个版本 */
  async removeVersion(id: string, versionId: string): Promise<void> {
    const project = await this.refresh()
    const item = this.requireArticle(project, id)
    const versions = item.versions ?? []
    if (versions.length <= 1) throw new Error('至少保留一个版本')
    const index = versions.findIndex((v) => v.id === versionId)
    if (index < 0) throw new Error(`未找到版本 ${versionId}`)
    const [removed] = versions.splice(index, 1)
    if (item.activeVersionId === versionId) {
      const next = versions[versions.length - 1]
      item.activeVersionId = next.id
      item.file = next.file
    }
    await this.persist(project)
    if (removed) {
      const filePath = window.preload.path.join(this.root, removed.file)
      if (window.preload.fs.existsSync(filePath)) {
        await window.preload.fs.rm(filePath)
      }
    }
  }

  /** 更新版本信息（字数 / 朱雀检测结果 / 自定义名） */
  async patchVersion(
    id: string,
    versionId: string,
    patch: Partial<Pick<ArticleVersion, 'label' | 'words' | 'zhuque'>>
  ): Promise<ArticleVersion> {
    const project = await this.refresh()
    const item = this.requireArticle(project, id)
    const version = item.versions?.find((v) => v.id === versionId)
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
