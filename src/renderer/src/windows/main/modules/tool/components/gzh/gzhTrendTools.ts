/**
 * 公众号爆款数据工具：抓取四榜 / 赛道爆款数据返回结构化结果供 AI 解读。
 * 抓取实现位于 main 进程（gzhTrends.ts，源站需 TLS 回退），本工具为薄封装。
 * 使用守则（泛化词闸门等）在场景 skill gzh-trends 中，此处只做参数校验与结果压缩。
 */
import { ToolFunction, ToolProperty } from '@/domain'

const SECTOR_ITEM_LIMIT = 30

const KEYWORDS_PROPERTY: ToolProperty = {
  type: 'array',
  items: { type: 'string', description: '细分赛道关键词' },
  description: '关键词列表（1-5 个，每个都会单独查询）。必须是细分赛道词（如「大厂裁员」「宠物殡葬」），大类词（职场 / 情感 / AI）禁止直接查询'
}

const SECTORS_PROPERTY: ToolProperty = {
  type: 'array',
  items: {
    type: 'object',
    description: '单个赛道定义',
    properties: {
      name: { type: 'string', description: '赛道名' },
      keywords: {
        type: 'array',
        items: { type: 'string', description: '细分关键词' },
        description: '该赛道的细分关键词组'
      }
    },
    required: ['name', 'keywords']
  },
  description: '赛道列表（1-5 个）：每个赛道绑定一组细分关键词，多词聚合为赛道日报'
}

/** 压缩单条文章为紧凑对象（工具结果最小化：只留解读必需字段） */
const compact = (item: {
  category: string
  keyword: string
  title: string
  accountName: string
  fans: string
  publicTime: string
  link: string
  reads: string
  likes: number
  comments: number
  shares: number
  score: number
}) => ({
  category: item.category,
  keyword: item.keyword,
  title: item.title,
  account: item.accountName,
  fans: item.fans,
  time: item.publicTime,
  link: item.link,
  reads: item.reads,
  likes: item.likes,
  comments: item.comments,
  shares: item.shares,
  score: item.score
})

export const gzhTrendTools: ToolFunction[] = [
  {
    name: 'gzh_trends',
    label: '公众号爆款数据',
    description:
      '抓取公众号爆款文章数据。mode=keyword：按细分关键词查四榜（低粉高阅读 / 阅读靠前 / 数据增长中 / 原创靠前），返回各榜 Top N 与跨榜综合榜；mode=sector：赛道日报，多赛道各自绑定一组细分关键词聚合对比。数据为热榜快照（默认近 7 天，最多 30 天），非指定账号全量历史。',
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['keyword', 'sector'],
          description: 'keyword=按关键词查四榜；sector=赛道日报（多关键词聚合）'
        },
        keywords: KEYWORDS_PROPERTY,
        sectors: { ...SECTORS_PROPERTY, description: `${SECTORS_PROPERTY.description}。mode=sector 时必填` },
        days: { type: 'number', description: '回看天数，默认 7，上限 30' },
        maxItems: { type: 'number', description: '每榜 / 每赛道返回条数上限，默认 10，上限 30' }
      },
      required: ['mode']
    },
    risk: 'safe',
    handler: async (...params: unknown[]) => {
      const args = params[0] as {
        mode?: string
        keywords?: unknown
        sectors?: unknown
        days?: number
        maxItems?: number
      }
      const mode = args.mode === 'sector' ? 'sector' : 'keyword'
      const keywords = Array.isArray(args.keywords)
        ? args.keywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
        : []
      const sectors = Array.isArray(args.sectors)
        ? args.sectors.filter(
            (s): s is { name: string; keywords: string[] } =>
              typeof s === 'object' &&
              s !== null &&
              typeof (s as { name?: unknown }).name === 'string' &&
              Array.isArray((s as { keywords?: unknown }).keywords)
          )
        : []
      if (mode === 'keyword' && !keywords.length) return { error: 'keyword 模式必须提供 keywords' }
      if (mode === 'sector' && !sectors.length) return { error: 'sector 模式必须提供 sectors' }
      const result = await window.preload.gzh.trends({
        mode,
        keywords,
        sectors,
        days: args.days,
        maxItems: args.maxItems ? Math.min(args.maxItems, SECTOR_ITEM_LIMIT) : undefined
      })
      const errors = result.errors ?? []
      if (
        !result.keywordResults?.length &&
        !result.sectorResults?.length &&
        errors.length
      ) {
        return { error: errors.join('；') }
      }
      return {
        // 压缩输出：boards 的 key 对 AI 无用，去掉；每条只留解读必需字段
        keywordResults: result.keywordResults?.map((r) => ({
          keyword: r.keyword,
          boards: r.boards.map((b) => ({ label: b.label, items: b.items.map(compact) })),
          merged: r.merged.map(compact)
        })),
        sectorResults: result.sectorResults?.map((s) => ({
          name: s.name,
          keywords: s.keywords,
          totalFetched: s.totalFetched,
          items: s.items.map(compact)
        })),
        errors
      }
    }
  }
]
