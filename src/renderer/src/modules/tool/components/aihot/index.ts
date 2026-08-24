// ==========================================
//  AIHOT 工具：AI 资讯热点查询（匿名只读公开 API + 本地精选镜像，全部 risk: safe）
//  与资讯页四页签一一对应：精选=aihot_selected（本地镜像）、动态=aihot_items（在线公开池）、
//  热点=aihot_hot_topics、日报=aihot_daily；事件时间线 / 日报归档索引仅保留在页面 UI，不暴露为工具
//  API 客户端见 @/modules/api/aihot；本地精选镜像见 @/modules/aihot（AihotSelectedService）
// ==========================================

import { ToolFunction } from '@/domain'
import {
  aihotApiV1DailiesDate,
  aihotApiV1DailiesLatest,
  aihotApiV1HotTopics,
  aihotApiV1Items
} from '@/modules/api/aihot'
import { getAihotMeta, listAihotItems, syncAihotSelected } from '@/modules/aihot'

/** 本地精选镜像自动增量同步间隔：距上次同步不足该值时直接读缓存（与资讯页 AUTO_SYNC_INTERVAL 一致） */
const AUTO_SYNC_INTERVAL = 5 * 60 * 1000

const runAihot = async (action: string, fn: () => Promise<unknown>) => {
  try {
    return await fn()
  } catch (err) {
    return { error: `${action}失败：${err instanceof Error ? err.message : String(err)}` }
  }
}

export const aihotTools: ToolFunction[] = [
  {
    name: 'aihot_hot_topics',
    label: 'AI 热门榜',
    description: '获取当前多来源 AI 热门榜（AIHOT Top 10，按多源覆盖与讨论热度排名）。',
    parameters: {
      type: 'object',
      properties: {}
    },
    risk: 'safe',
    handler: async () => runAihot('获取热门榜', aihotApiV1HotTopics)
  },
  {
    name: 'aihot_items',
    label: 'AI 动态检索',
    description:
      '检索近期公开 AI 条目（在线公开池，仅最近 7 天窗口）。可按关键词、分类、时间窗口过滤，适合查询最新的 AI 模型、AI 产品、行业动态、论文与技巧。',
    parameters: {
      type: 'object',
      properties: {
        q: { type: 'string', description: '关键词（去首尾空白后 2–200 字符）' },
        category: {
          type: 'string',
          enum: ['ai-models', 'ai-products', 'industry', 'paper', 'tip'],
          description: '分类：AI 模型 / AI 产品 / 行业 / 论文 / 技巧'
        },
        window: { type: 'string', enum: ['24h', '7d'], description: '时间窗口，默认 7d' },
        by: {
          type: 'string',
          enum: ['timeline', 'published'],
          description: '窗口与排序所用时间戳基准：timeline=发现时间（默认），published=发布时间'
        },
        limit: { type: 'number', description: '返回条数（1–100，默认 20）' }
      }
    },
    risk: 'safe',
    handler: async (...params: unknown[]) =>
      runAihot('检索条目', async () => {
        const { q, category, window: timeWindow, by, limit } = params[0] as {
          q?: string
          category?: string
          window?: '24h' | '7d'
          by?: 'timeline' | 'published'
          limit?: number
        }
        return aihotApiV1Items({
          mode: 'all',
          q,
          category,
          window: timeWindow,
          by,
          limit: Math.min(Math.max(Math.floor(limit ?? 20), 1), 100)
        })
      })
  },
  {
    name: 'aihot_daily',
    label: 'AIHOT 日报',
    description:
      '获取 AIHOT 日报全文（每日 08:00 上海时间生成，含导语、分栏条目与快讯）。不传 date 取最新一期。',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: '上海日期（YYYY-MM-DD），缺省取最新一期' }
      }
    },
    risk: 'safe',
    handler: async (...params: unknown[]) =>
      runAihot('获取日报', async () => {
        const { date } = params[0] as { date?: string }
        const resp = date ? await aihotApiV1DailiesDate(date) : await aihotApiV1DailiesLatest()
        return resp.report
      })
  },
  {
    name: 'aihot_selected',
    label: 'AIHOT 精选库',
    description:
      '查询 AIHOT 精选集全量内容（应用本地镜像，覆盖全量历史，不受 7 天窗口限制，条目含摘要）。首次使用会自动初始化镜像；数据距上次同步超过约 5 分钟或传 refresh=true 时，会先执行增量同步再查询。',
    parameters: {
      type: 'object',
      properties: {
        q: { type: 'string', description: '关键词（≥2 字符生效，匹配标题与摘要）' },
        category: {
          type: 'string',
          enum: ['ai-models', 'ai-products', 'industry', 'paper', 'tip'],
          description: '分类：AI 模型 / AI 产品 / 行业 / 论文 / 技巧'
        },
        window: {
          type: 'string',
          enum: ['24h', '7d', 'all'],
          description: '时间窗口，默认 all（全量历史）'
        },
        by: {
          type: 'string',
          enum: ['timeline', 'published'],
          description: '排序基准：timeline=发现时间（默认），published=发布时间'
        },
        limit: { type: 'number', description: '返回条数（1–100，默认 20）' },
        refresh: { type: 'boolean', description: '先强制增量同步再查询（默认 false）' }
      }
    },
    risk: 'safe',
    handler: async (...params: unknown[]) =>
      runAihot('查询精选库', async () => {
        const {
          q,
          category,
          window: timeWindow,
          by,
          limit,
          refresh
        } = params[0] as {
          q?: string
          category?: string
          window?: '24h' | '7d' | 'all'
          by?: 'timeline' | 'published'
          limit?: number
          refresh?: boolean
        }
        // 从未引导镜像 / 数据过旧 / 显式 refresh 时先同步，否则直接读本地缓存
        const meta = await getAihotMeta()
        const stale = !meta.syncedAt || Date.now() - Date.parse(meta.syncedAt) >= AUTO_SYNC_INTERVAL
        if (!meta.cursor || refresh || stale) await syncAihotSelected()
        const res = await listAihotItems(
          {
            keyword: q ?? '',
            category: category ?? '',
            timeWindow: timeWindow ?? 'all',
            by: by ?? 'timeline'
          },
          Math.min(Math.max(Math.floor(limit ?? 20), 1), 100),
          0
        )
        return {
          syncedAt: (await getAihotMeta()).syncedAt,
          total: res.total,
          hasMore: res.total > res.items.length,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          items: res.items.map(({ read: _read, ...item }) => item)
        }
      })
  }
]
