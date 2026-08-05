import type { ToolFunction } from '@/domain'
import { registerToolPolicy } from '@/modules/tool/toolPolicy'
import type { ChatTypeToolContext } from '@/modules/chat/chatType'
import { buildArticleRoot, getArticleStore } from './articleStore'
import type { ArticlePlatform, ArticleStatus, ArticleUpdatePatch } from './articleTypes'

const PLATFORMS = new Set<string>(['公众号', '知乎', '小红书', '其他'])
const STATUSES = new Set<string>(['draft', 'writing', 'done'])

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

const strArray = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : undefined

const err = (msg: string): never => {
  throw new Error(msg)
}

/**
 * 返回文章场景工具实例（按 workspace / sandbox 定位项目根），供 WritingSceneConfig 场景级注入。
 * 项目根：{workspace}/articles/（有工作空间）或 {sandbox}/outputs/articles/（无工作空间）。
 */
export const createArticleTools = (ctx: ChatTypeToolContext): ToolFunction[] => {
  const store = () => getArticleStore(buildArticleRoot(ctx.getWorkspace(), ctx.getSandboxDir()))

  return [
    {
      name: 'article_init',
      label: '初始化文章项目',
      description: '初始化文章创作项目（创建 / 读取项目索引），可指定项目标题。通常首次进入文章场景时调用',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '项目标题（可选，用于侧边栏辨识）' }
        }
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { title } = params[0] as { title?: string }
        const project = await store().init(title)
        return { success: true, title: project.title, articleCount: project.articles.length }
      }
    },
    {
      name: 'article_list',
      label: '列出文章',
      description: '列出项目内全部文章（标题 / 平台 / 状态 / 字数 / 封面 / 配图 / 文件路径），写作前先看现状',
      parameters: { type: 'object', properties: {} },
      internal: true,
      risk: 'safe',
      handler: async () => {
        await store().refresh()
        return { articles: store().listArticles() }
      }
    },
    {
      name: 'article_create',
      label: '新建文章',
      description:
        '新建一篇文章：创建正文 md 文件（drafts/ 下）并登记到项目索引，返回文章 id 与正文文件路径。后续用 file_write 写入正文、用 article_update 更新状态',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '文章标题' },
          platform: {
            type: 'string',
            description: '目标平台：公众号 / 知乎 / 小红书 / 其他（缺省其他）'
          },
          summary: { type: 'string', description: '一句话选题 / 摘要（可选）' },
          outline: { type: 'string', description: '提纲（可选）' }
        },
        required: ['title']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { title, platform, summary, outline } = params[0] as {
          title?: string
          platform?: string
          summary?: string
          outline?: string
        }
        if (!title) return { error: 'title 不能为空' }
        const item = await store().createArticle({
          title,
          platform: platform && PLATFORMS.has(platform) ? (platform as ArticlePlatform) : '其他',
          summary,
          outline
        })
        return { id: item.id, file: item.file, platform: item.platform }
      }
    },
    {
      name: 'article_update',
      label: '更新文章信息',
      description:
        '更新文章元信息（标题 / 平台 / 状态 / 摘要 / 提纲 / 封面 / 配图）。配图由 design 子 Agent 产出后，用 cover / images 登记相对路径（相对 articles/）',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '文章 id（article_list 获取）' },
          title: { type: 'string', description: '标题' },
          platform: { type: 'string', description: '平台：公众号 / 知乎 / 小红书 / 其他' },
          status: { type: 'string', description: '状态：draft（草稿）/ writing（写作中）/ done（已完稿）' },
          summary: { type: 'string', description: '一句话摘要' },
          outline: { type: 'string', description: '提纲' },
          cover: { type: 'string', description: '封面图相对路径（如 assets/cover.png，相对 articles/）' },
          images: {
            type: 'array',
            items: { type: 'string', description: '配图相对路径' },
            description: '配图相对路径列表'
          }
        },
        required: ['id']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { id, title, platform, status, summary, outline, cover, images } = params[0] as {
          id?: string
          title?: string
          platform?: string
          status?: string
          summary?: string
          outline?: string
          cover?: string
          images?: unknown
        }
        if (!id) return { error: 'id 不能为空' }
        const patch: ArticleUpdatePatch = {}
        if (str(title)) patch.title = title
        if (platform && PLATFORMS.has(platform)) patch.platform = platform as ArticlePlatform
        if (status && STATUSES.has(status)) patch.status = status as ArticleStatus
        if (str(summary)) patch.summary = summary
        if (str(outline)) patch.outline = outline
        if (str(cover)) patch.cover = cover
        const imgs = strArray(images)
        if (imgs) patch.images = imgs
        if (Object.keys(patch).length === 0) return { error: '没有可更新的字段' }
        const item = await store().updateArticle(id, patch)
        return { id: item.id, updated: patch }
      }
    },
    {
      name: 'article_read',
      label: '读取文章正文',
      description: '读取指定文章的完整 markdown 正文，供改写 / 续写 / 分析前查看',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '文章 id（article_list 获取）' } },
        required: ['id']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { id } = params[0] as { id?: string }
        if (!id) return { error: 'id 不能为空' }
        try {
          const content = await store().readArticle(id)
          return { content }
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
      }
    },
    {
      name: 'article_stats',
      label: '统计文章字数',
      description: '统计指定文章的字数（去空白字符数）并回写登记，用于进度跟踪与完稿确认',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '文章 id（article_list 获取）' } },
        required: ['id']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { id } = params[0] as { id?: string }
        if (!id) return { error: 'id 不能为空' }
        try {
          const words = await store().countWords(id)
          return { id, words }
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
      }
    },
    {
      name: 'article_remove',
      label: '删除文章',
      description: '删除指定文章：移除项目登记并删除其正文 md 文件',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '文章 id（article_list 获取）' } },
        required: ['id']
      },
      internal: true,
      risk: 'dangerous',
      handler: async (...params: unknown[]) => {
        const { id } = params[0] as { id?: string }
        if (!id) return { error: 'id 不能为空' }
        try {
          await store().removeArticle(id)
          return { success: true }
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
      }
    }
  ]
}

/** 文章工具完整清单（单一数据源：工具工厂与安全策略注册共用） */
export const ARTICLE_TOOL_NAMES = [
  'article_init',
  'article_list',
  'article_create',
  'article_update',
  'article_read',
  'article_stats',
  'article_remove'
] as const

/**
 * 文章工具安全策略：article_* 只读写项目根（workspace/articles 或沙盒 outputs/articles）可信区，
 * 默认模式（mode=0）下直接放行，避免每次编辑都挂起等待审批。
 * 计划模式（mode=1）仍按模式策略 deny（写入类操作），行为保持一致。
 */
for (const name of ARTICLE_TOOL_NAMES) {
  registerToolPolicy({ name, resolve: () => 'allow' })
}
