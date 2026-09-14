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

const ID_DESC = '文章单元 id（「标题+类型+版本」单元标识，article_create 返回、article_list 可查）'

/**
 * 返回文章场景工具实例（按 workspace / sandbox 定位项目根），供 WritingSceneConfig 场景级注入。
 * 项目根：{workspace}/articles/（有工作空间）或 {sandbox}/outputs/articles/（无工作空间）。
 * 唯一单元 = 标题 + 类型（平台）+ 版本，id 即单元标识：创建返回 id，写入 / 读取 / 统计只认 id；
 * 新建版本返回新 id，后续写入用新 id。工具层不感知类型寻址，全部由 store 按版本 id 解析。
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
        '列出项目内全部文章：标题 / 摘要 / 提纲 / 各类型（平台、封面、配图）及其版本列表（每个版本即一个单元，含单元 id、版本号、来源、字数）。写入或读取前先从这里拿单元 id',
      parameters: { type: 'object', properties: {} },
      internal: true,
      risk: 'safe',
      handler: async () => {
        await store().refresh()
        return {
          articles: store().listArticles().map((a) => ({
            title: a.title,
            summary: a.summary,
            outline: a.outline,
            types: a.types.map((t) => ({
              type: t.type,
              cover: t.cover,
              images: t.images,
              versions: (t.versions ?? []).map((v) => ({
                id: v.id,
                version: v.no,
                source: v.source,
                words: v.words
              }))
            }))
          }))
        }
      }
    },
    {
      name: 'article_create',
      label: '新建文章单元',
      description:
        '创建「标题+类型+版本」文章单元并返回其 id：同标题视为同一主题（可传 summary / outline 登记选题与提纲）。类型缺省「其他」；版本号缺省自动（新类型=1，已有类型=最新版本号+1；同号已存在则幂等复用返回已有 id）。后续用返回的 id 写入正文',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '文章标题（主题，同标题自动归入同一篇文章）' },
          type: { type: 'string', description: `${TYPE_DESC}（缺省其他）` },
          version: { type: 'number', description: '版本号（正整数，缺省自动分配）' },
          summary: { type: 'string', description: '一句话选题 / 摘要（可选）' },
          outline: { type: 'string', description: '提纲（可选）' }
        },
        required: ['title']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { title, type, version, summary, outline } = params[0] as {
          title?: string
          type?: string
          version?: number
          summary?: string
          outline?: string
        }
        if (!title) return { error: 'title 不能为空' }
        const unit = await store().createArticle({ title, type, version, summary, outline })
        return unit
      }
    },
    {
      name: 'article_write',
      label: '写入文章正文',
      description:
        '把完整 markdown 正文写入指定单元（只需 id + 内容，无需类型）：默认覆盖该版本（在原文上修改）；要保留原稿另存新版本时传 newVersion=true，返回新 id，后续修改写入新 id。正文引用配图一律用相对路径（如 ../assets/xxx.png）',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: ID_DESC },
          content: { type: 'string', description: '完整 markdown 正文' },
          newVersion: {
            type: 'boolean',
            description: '是否另存为新版本（默认 false 覆盖当前版本；重写 / 大幅改写须为 true，返回新 id）'
          }
        },
        required: ['id', 'content']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { id, content, newVersion } = params[0] as {
          id?: string
          content?: string
          newVersion?: boolean
        }
        if (!id) return { error: 'id 不能为空' }
        if (typeof content !== 'string' || !content.trim()) return { error: 'content 不能为空' }
        try {
          const result = await store().writeContent(id, content, newVersion === true)
          return { id: result.id, version: result.version, file: result.file, words: result.words }
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
      }
    },
    {
      name: 'article_read',
      label: '读取文章正文',
      description: '读取指定单元（版本 id）的完整 markdown 正文，供改写 / 续写 / 分析前查看',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: ID_DESC }
        },
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
      description: '统计指定单元（版本 id）的字数（去空白字符数）并回写登记，用于进度跟踪与完稿确认',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: ID_DESC }
        },
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
      name: 'article_update',
      label: '更新文章信息',
      description:
        '更新文章信息（按单元 id 定位）：title / summary / outline 为文章级（作用于所属文章）；cover / images 为类型级（作用于单元所属类型）。配图由 design 子 Agent 产出后，用 cover / images 登记相对路径（相对 articles/）',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: ID_DESC },
          title: { type: 'string', description: '标题（文章级）' },
          summary: { type: 'string', description: '一句话摘要（文章级）' },
          outline: { type: 'string', description: '提纲（文章级）' },
          cover: { type: 'string', description: '所属类型封面图相对路径（如 assets/cover.png，相对 articles/）' },
          images: {
            type: 'array',
            items: { type: 'string', description: '配图相对路径' },
            description: '所属类型配图相对路径列表'
          }
        },
        required: ['id']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { id, title, summary, outline, cover, images } = params[0] as {
          id?: string
          title?: string
          summary?: string
          outline?: string
          cover?: string
          images?: unknown
        }
        if (!id) return { error: 'id 不能为空' }
        const patch: ArticleUpdatePatch & ArticleTypePatch = {}
        if (str(title)) patch.title = title
        if (str(summary)) patch.summary = summary
        if (str(outline)) patch.outline = outline
        if (str(cover)) patch.cover = cover
        const imgs = strArray(images)
        if (imgs) patch.images = imgs
        if (Object.keys(patch).length === 0) return { error: '没有可更新的字段' }
        try {
          const updated = await store().updateUnit(id, patch)
          return { id, updated }
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
      }
    },
    {
      name: 'article_remove',
      label: '删除文章',
      description:
        '删除指定单元所属的整篇文章（同标题的全部类型与版本一并删除：移除项目登记并删除正文 md 文件）',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: ID_DESC } },
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
