import type { ToolFunction } from '@/domain'
import { registerToolPolicy } from '@/windows/main/modules/tool/toolPolicy'
import type { ChatTypeToolContext } from '@/windows/main/modules/chat/chatType'
import { buildArticleRoot, getArticleStore } from './articleStore'
import type { ArticleTypePatch, ArticleUpdatePatch } from './articleTypes'
import { ARTICLE_TYPES } from './articleTypes'

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

const strArray = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : undefined

/** 类型描述（供工具参数说明复用；类型由 AI 自由命名，同一文章内唯一） */
const TYPE_DESC = `类型（发布平台，自由命名）：推荐 ${ARTICLE_TYPES.join(' / ')} 等；同一文章内唯一，同名自动复用已有类型`

/**
 * 返回文章场景工具实例（按 workspace / sandbox 定位项目根），供 WritingSceneConfig 场景级注入。
 * 项目根：{workspace}/articles/（有工作空间）或 {sandbox}/outputs/articles/（无工作空间）。
 * 一篇文章 = 一个主题，可有多个类型（平台），每个类型独立版本；类型不存在时写入类操作自动创建。
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
      description:
        '列出项目内全部文章：标题 / 摘要 / 提纲 / 类型列表（每个类型含平台、字数、封面、配图）。写作前先看现状',
      parameters: { type: 'object', properties: {} },
      internal: true,
      risk: 'safe',
      handler: async () => {
        await store().refresh()
        return {
          articles: store().listArticles().map((a) => ({
            id: a.id,
            title: a.title,
            summary: a.summary,
            outline: a.outline,
            types: a.types.map((t) => ({
              type: t.type,
              words: t.words,
              cover: t.cover,
              images: t.images
            }))
          }))
        }
      }
    },
    {
      name: 'article_create',
      label: '新建文章',
      description:
        '新建一篇文章（一个主题）：以指定类型创建首个类型条目（含空正文文件）并登记到项目索引，返回文章 id。后续用 article_write 写入正文、用 article_update 更新封面 / 配图',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '文章标题（主题）' },
          type: { type: 'string', description: `首个${TYPE_DESC}（缺省其他）` },
          summary: { type: 'string', description: '一句话选题 / 摘要（可选）' },
          outline: { type: 'string', description: '提纲（可选）' }
        },
        required: ['title']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { title, type, summary, outline } = params[0] as {
          title?: string
          type?: string
          summary?: string
          outline?: string
        }
        if (!title) return { error: 'title 不能为空' }
        const item = await store().createArticle({ title, type, summary, outline })
        return { id: item.id, types: item.types.map((t) => t.type) }
      }
    },
    {
      name: 'article_write',
      label: '写入文章正文',
      description:
        '把完整 markdown 正文写入指定文章的指定类型：默认覆盖该类型当前版本（适合小修小补）；大改动 / 重写必须传 newVersion=true 另存为新版本（保留原版本，用户可在侧边栏版本历史中对比恢复）。指定的类型不存在时自动创建（如为已有文章追加小红书版）。正文引用配图一律用相对路径（如 ../assets/xxx.png）',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '文章 id（article_list 获取）' },
          content: { type: 'string', description: '完整 markdown 正文' },
          type: { type: 'string', description: TYPE_DESC },
          newVersion: {
            type: 'boolean',
            description: '是否另存为新版本（默认 false 覆盖当前版本；重写 / 大幅改写须为 true）'
          }
        },
        required: ['id', 'content']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { id, content, type, newVersion } = params[0] as {
          id?: string
          content?: string
          type?: string
          newVersion?: boolean
        }
        if (!id) return { error: 'id 不能为空' }
        if (typeof content !== 'string' || !content.trim()) return { error: 'content 不能为空' }
        try {
          const result = await store().writeContent(id, type ?? '', content, newVersion === true)
          return {
            id,
            type: result.type,
            file: result.file,
            versionId: result.versionId,
            words: result.words
          }
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
      }
    },
    {
      name: 'article_update',
      label: '更新文章信息',
      description:
        '更新文章信息：title / summary / outline 为文章级；cover / images 为类型级（作用于指定 type，缺省第一个类型；类型不存在自动创建）。配图由 design 子 Agent 产出后，用 cover / images 登记相对路径（相对 articles/）',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '文章 id（article_list 获取）' },
          title: { type: 'string', description: '标题（文章级）' },
          summary: { type: 'string', description: '一句话摘要（文章级）' },
          outline: { type: 'string', description: '提纲（文章级）' },
          type: { type: 'string', description: `${TYPE_DESC}；cover / images 作用于该类型` },
          cover: { type: 'string', description: '该类型封面图相对路径（如 assets/cover.png，相对 articles/）' },
          images: {
            type: 'array',
            items: { type: 'string', description: '配图相对路径' },
            description: '该类型配图相对路径列表'
          }
        },
        required: ['id']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { id, title, summary, outline, type, cover, images } = params[0] as {
          id?: string
          title?: string
          summary?: string
          outline?: string
          type?: string
          cover?: string
          images?: unknown
        }
        if (!id) return { error: 'id 不能为空' }
        try {
          const articlePatch: ArticleUpdatePatch = {}
          if (str(title)) articlePatch.title = title
          if (str(summary)) articlePatch.summary = summary
          if (str(outline)) articlePatch.outline = outline
          if (Object.keys(articlePatch).length > 0) await store().updateArticle(id, articlePatch)

          const typePatch: ArticleTypePatch = {}
          if (str(cover)) typePatch.cover = cover
          const imgs = strArray(images)
          if (imgs) typePatch.images = imgs
          let updatedType: string | undefined
          if (Object.keys(typePatch).length > 0) {
            const entry = await store().updateType(id, type ?? '', typePatch)
            updatedType = entry.type
          }
          if (!articlePatch.title && !articlePatch.summary && !articlePatch.outline && !updatedType) {
            return { error: '没有可更新的字段' }
          }
          return { id, updated: { ...articlePatch, ...(updatedType ? { type: updatedType, ...typePatch } : {}) } }
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
      }
    },
    {
      name: 'article_read',
      label: '读取文章正文',
      description: '读取指定文章指定类型的完整 markdown 正文（缺省第一个类型），供改写 / 续写 / 分析前查看',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '文章 id（article_list 获取）' },
          type: { type: 'string', description: TYPE_DESC }
        },
        required: ['id']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { id, type } = params[0] as { id?: string; type?: string }
        if (!id) return { error: 'id 不能为空' }
        if (!type) return { error: 'type 不能为空（article_list 可查看文章已有类型）' }
        try {
          const content = await store().readArticle(id, type)
          return { content }
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
      }
    },
    {
      name: 'article_stats',
      label: '统计文章字数',
      description: '统计指定文章指定类型的字数（去空白字符数）并回写登记，用于进度跟踪与完稿确认',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '文章 id（article_list 获取）' },
          type: { type: 'string', description: TYPE_DESC }
        },
        required: ['id']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { id, type } = params[0] as { id?: string; type?: string }
        if (!id) return { error: 'id 不能为空' }
        if (!type) return { error: 'type 不能为空（article_list 可查看文章已有类型）' }
        try {
          const words = await store().countWords(id, type)
          return { id, type, words }
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
      }
    },
    {
      name: 'article_remove',
      label: '删除文章',
      description: '删除指定文章：移除项目登记并删除其全部类型的全部正文 md 文件',
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
  'article_write',
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
