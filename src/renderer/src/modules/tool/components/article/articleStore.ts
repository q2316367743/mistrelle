import { nanoid } from 'nanoid'
import type { ArticleCreateInput, ArticleItem, ArticleProject, ArticleUpdatePatch } from './articleTypes'

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

  /** 新增文章：创建正文 md 文件并登记到索引 */
  async createArticle(input: ArticleCreateInput): Promise<ArticleItem> {
    const project = await this.refresh()
    const id = nanoid(8)
    const file = `drafts/${id}.md`
    const item: ArticleItem = {
      id,
      title: input.title,
      platform: input.platform,
      status: 'draft',
      file,
      summary: input.summary,
      outline: input.outline
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

  /** 删除文章：移除登记并删除正文 md 文件（若存在） */
  async removeArticle(id: string): Promise<void> {
    const project = await this.refresh()
    const index = project.articles.findIndex((a) => a.id === id)
    if (index < 0) throw new Error(`未找到文章 ${id}，可用 article_list 获取 id`)
    const [removed] = project.articles.splice(index, 1)
    await this.persist(project)
    if (removed) {
      const filePath = buildArticleFilePath(this.root, removed.id)
      if (window.preload.fs.existsSync(filePath)) {
        await window.preload.fs.rm(filePath)
      }
    }
  }

  /** 读取文章正文（markdown 文本） */
  async readArticle(id: string): Promise<string> {
    const project = await this.refresh()
    const item = project.articles.find((a) => a.id === id)
    if (!item) throw new Error(`未找到文章 ${id}，可用 article_list 获取 id`)
    const filePath = window.preload.path.join(this.root, item.file)
    if (!window.preload.fs.existsSync(filePath)) {
      throw new Error(`文章正文文件不存在：${filePath}`)
    }
    return window.preload.fs.readTextFile(filePath)
  }

  /** 统计文章字数（去空白字符数），回写 item.words 并落盘 */
  async countWords(id: string): Promise<number> {
    const project = await this.refresh()
    const item = project.articles.find((a) => a.id === id)
    if (!item) throw new Error(`未找到文章 ${id}，可用 article_list 获取 id`)
    const text = await this.readArticle(id)
    const words = countChars(text)
    item.words = words
    await this.persist(project)
    return words
  }

  private async persist(project: ArticleProject): Promise<void> {
    project.updatedTime = Date.now()
    if (!window.preload.fs.existsSync(this.root)) {
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
