import { nanoid } from 'nanoid'
import {
  NOVEL_FILES,
  type NovelCreateInput,
  type NovelFileKey,
  type NovelItem,
  type NovelProject,
  type NovelUpdatePatch
} from './novelTypes'

/** 项目管理索引文件名 */
const PROJECT_FILE = 'project.json'

/** 小说项目根目录：有工作空间优先用工作空间，否则退回沙盒 outputs/ */
export const buildNovelRoot = (workspace: string, sandboxDir: string): string => {
  const base = workspace || window.preload.path.join(sandboxDir, 'outputs')
  return window.preload.path.join(base, 'novels')
}

/** 项目索引文件路径 */
const buildProjectPath = (root: string): string => window.preload.path.join(root, PROJECT_FILE)

/** 小说子目录绝对路径（{root}/{id}） */
const buildNovelDir = (root: string, id: string): string => window.preload.path.join(root, id)

/** 小说内某文件路径（{root}/{id}/{file}） */
export const buildNovelFilePath = (root: string, id: string, file: string): string =>
  window.preload.path.join(buildNovelDir(root, id), file)

/** 各设定文件落盘骨架（novel_create 时预建，给 AI 明确的结构指引，之后用 file_write 覆盖） */
export const NOVEL_FILE_SKELETONS: Record<NovelFileKey, string> = {
  story: '# 正文\n',
  outline: [
    '# 故事大纲',
    '',
    '## 核心冲突',
    '- 一句话概括本篇的核心冲突',
    '',
    '## 起承转合',
    '- 起：故事的开始与人物登场',
    '- 承：冲突发展、阻碍升级',
    '- 转：关键转折 / 高潮',
    '- 合：收尾与结局'
  ].join('\n'),
  characters: [
    '# 角色卡',
    '',
    '## （角色名）',
    '- 身份：',
    '- 外貌：',
    '- 性格：',
    '- 背景：',
    '- 与其他角色的关系：',
    '- 成长弧线：'
  ].join('\n'),
  setting: ['# 背景设定', '', '- 时代 / 背景：', '', '## 主题与核心冲突', '- 主题：', '- 核心冲突：', '- 立意：'].join(
    '\n'
  ),
  style: ['# 写作风格 / 文风', '', '- 叙事视角：第三人称', '- 语言风格：', '- 叙事节奏：', '- 其他约定：'].join('\n')
}

const emptyProject = (title?: string): NovelProject => ({
  schema: 1,
  title: title ?? '',
  updatedTime: Date.now(),
  novels: []
})

/**
 * 在 markdown 文本中替换指定「## 标题」段（到下一个 ## 或文件尾为止）；
 * 未找到该段时返回 null。
 */
const replaceSection = (text: string, heading: string, block: string): string | null => {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      end = i
      break
    }
  }
  const head = lines.slice(0, start).join('\n').trim()
  const tail = lines.slice(end).join('\n').trim()
  const parts = [head, block.trim(), tail].filter((p) => p.length > 0)
  return parts.join('\n\n')
}

/**
 * 短篇小说项目管理 store（按 root 键控的全局单例）：
 * - 工具与侧边栏共享同一响应式实例：AI 变更实时驱动 UI
 * - 每次变更自动落盘 project.json，重启聊天可恢复
 * root 为 novels/ 目录绝对路径（见 buildNovelRoot）。
 */
export class NovelStore {
  /** 当前项目管理索引（deep reactive） */
  readonly project = ref<NovelProject | null>(null)

  constructor(private readonly root: string) {}

  /**
   * 刷新项目索引：project.json 不存在时自动创建空项目并落盘（幂等）。
   * 侧边栏挂载 / 工具首次调用时执行。
   */
  async refresh(): Promise<NovelProject> {
    const path = buildProjectPath(this.root)
    if (window.preload.fs.existsSync(path)) {
      try {
        const parsed = JSON.parse(await window.preload.fs.readTextFile(path)) as NovelProject
        if (parsed && Array.isArray(parsed.novels)) {
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
  async init(title?: string): Promise<NovelProject> {
    const project = await this.refresh()
    if (title) {
      project.title = title
      await this.persist(project)
    }
    return project
  }

  /** 小说列表（按创建顺序） */
  listNovels(): NovelItem[] {
    return this.project.value?.novels ?? []
  }

  /** 新增小说：创建子目录 + 5 个骨架文件并登记到索引 */
  async createNovel(input: NovelCreateInput): Promise<NovelItem> {
    const project = await this.refresh()
    const id = nanoid(8)
    const dir = `${id}`
    const item: NovelItem = {
      id,
      title: input.title,
      genre: input.genre,
      status: 'draft',
      dir,
      summary: input.summary
    }
    await window.preload.fs.mkdir(buildNovelDir(this.root, id), true)
    for (const [key, file] of Object.entries(NOVEL_FILES) as [NovelFileKey, string][]) {
      await window.preload.fs.writeTextFile(
        buildNovelFilePath(this.root, id, file),
        NOVEL_FILE_SKELETONS[key]
      )
    }
    project.novels.push(item)
    await this.persist(project)
    return item
  }

  /** 更新小说元信息（白名单字段） */
  async updateNovel(id: string, patch: NovelUpdatePatch): Promise<NovelItem> {
    const project = await this.refresh()
    const item = project.novels.find((n) => n.id === id)
    if (!item) throw new Error(`未找到小说 ${id}，可用 novel_list 获取 id`)
    Object.assign(item, patch)
    await this.persist(project)
    return item
  }

  /** 删除小说：移除登记并删除整个子目录（若存在） */
  async removeNovel(id: string): Promise<void> {
    const project = await this.refresh()
    const index = project.novels.findIndex((n) => n.id === id)
    if (index < 0) throw new Error(`未找到小说 ${id}，可用 novel_list 获取 id`)
    project.novels.splice(index, 1)
    await this.persist(project)
    const dir = buildNovelDir(this.root, id)
    if (window.preload.fs.existsSync(dir)) {
      await window.preload.fs.rm(dir)
    }
  }

  /** 读取小说内某文件内容（正文 / 设定；文件不存在返回空字符串） */
  async readNovelFile(id: string, file: string): Promise<string> {
    await this.refresh()
    const filePath = buildNovelFilePath(this.root, id, file)
    if (!window.preload.fs.existsSync(filePath)) return ''
    return window.preload.fs.readTextFile(filePath)
  }

  /** 写入小说内某文件内容（正文 / 设定） */
  async writeNovelFile(id: string, file: string, content: string): Promise<void> {
    await this.refresh()
    const filePath = buildNovelFilePath(this.root, id, file)
    await window.preload.fs.mkdir(window.preload.path.dirname(filePath), true)
    await window.preload.fs.writeTextFile(filePath, content)
  }

  /** 读取小说正文（story.md，供 novel_read 工具用） */
  async readStory(id: string): Promise<string> {
    return this.readNovelFile(id, NOVEL_FILES.story)
  }

  /** 汇总读取小说全部设定文件（novel_read_setting，正文写作前注入上下文保证一致性） */
  async readSetting(id: string): Promise<Record<Exclude<NovelFileKey, 'story'>, string>> {
    const setting = {} as Record<Exclude<NovelFileKey, 'story'>, string>
    for (const [key, file] of Object.entries(NOVEL_FILES) as [NovelFileKey, string][]) {
      if (key !== 'story') setting[key] = await this.readNovelFile(id, file)
    }
    return setting
  }

  /** 角色卡 upsert：## name 段已存在则替换，否则追加到 characters.md 末尾 */
  async upsertCharacter(id: string, name: string, content: string): Promise<string> {
    await this.refresh()
    const filePath = buildNovelFilePath(this.root, id, NOVEL_FILES.characters)
    const existing = window.preload.fs.existsSync(filePath)
      ? await window.preload.fs.readTextFile(filePath)
      : ''
    const heading = `## ${name}`
    const block = `${heading}\n${content.trim()}`
    const replaced = replaceSection(existing, heading, block)
    const updated = replaced ?? (existing.trim().length > 0 ? `${existing.trim()}\n\n${block}` : block)
    await window.preload.fs.mkdir(window.preload.path.dirname(filePath), true)
    await window.preload.fs.writeTextFile(filePath, updated)
    return updated
  }

  private async persist(project: NovelProject): Promise<void> {
    project.updatedTime = Date.now()
    if (!window.preload.fs.existsSync(this.root)) {
      await window.preload.fs.mkdir(this.root, true)
    }
    await window.preload.fs.writeTextFile(buildProjectPath(this.root), JSON.stringify(project))
  }
}

const stores = new Map<string, NovelStore>()

/** 获取指定 root 的小说 store（存在即复用，跨组件与工具共享同一响应式实例） */
export const getNovelStore = (root: string): NovelStore => {
  let store = stores.get(root)
  if (!store) {
    store = new NovelStore(root)
    stores.set(root, store)
  }
  return store
}

/** 销毁指定 root 的小说 store（释放内存；root 变化时由调用方调用） */
export const destroyNovelStore = (root: string): void => {
  stores.delete(root)
}
