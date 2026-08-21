// ==========================================
//  AIHOT 工具：AI 资讯热点查询（匿名只读公开 API，全部 risk: safe）
//  API 客户端见 @/modules/api/aihot
// ==========================================

import { ToolFunction } from '@/domain'
import {
  aihotApiV1Dailies,
  aihotApiV1DailiesDate,
  aihotApiV1DailiesLatest,
  aihotApiV1HotTopics,
  aihotApiV1Items,
  aihotApiV1SelectedChanges,
  aihotApiV1SelectedSnapshot,
  aihotApiV1Stories
} from '@/modules/api/aihot'

/** 从热门话题的 links.story URL 末段提取故事 publicId，便于模型直接调用 aihot_story */
const storyPublicIdOf = (url?: string): string | undefined =>
  url ? url.split('/').filter(Boolean).pop() : undefined

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
    description:
      '获取当前多来源 AI 热门榜（AIHOT Top 10，按多源覆盖与讨论热度排名）。需要深入了解某个话题时，用返回的 storyPublicId 调用 aihot_story 查看事件时间线。',
    parameters: {
      type: 'object',
      properties: {}
    },
    risk: 'safe',
    handler: async () =>
      runAihot('获取热门榜', async () => {
        const resp = await aihotApiV1HotTopics()
        return {
          count: resp.count,
          items: resp.items.map((e) => ({ ...e, storyPublicId: storyPublicIdOf(e.links.story) }))
        }
      })
  },
  {
    name: 'aihot_items',
    label: 'AI 条目检索',
    description:
      '检索近期公开 AI 条目（仅最近 7 天窗口）。可按关键词、分类、时间窗口过滤，适合查询最新的 AI 模型、AI 产品、行业动态、论文与技巧。',
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
        mode: {
          type: 'string',
          enum: ['selected', 'all'],
          description: 'selected=精选条目（默认），all=全部条目'
        },
        limit: { type: 'number', description: '返回条数（1–100，默认 20）' }
      }
    },
    risk: 'safe',
    handler: async (...params: unknown[]) =>
      runAihot('检索条目', async () => {
        const { q, category, mode, window: timeWindow, limit } = params[0] as {
          q?: string
          category?: string
          mode?: 'selected' | 'all'
          window?: '24h' | '7d'
          limit?: number
        }
        return aihotApiV1Items({
          q,
          category,
          mode,
          window: timeWindow,
          limit: Math.min(Math.max(Math.floor(limit ?? 20), 1), 100)
        })
      })
  },
  {
    name: 'aihot_story',
    label: 'AI 事件时间线',
    description:
      '获取单个 AI 事件（故事）的完整时间线、相关报道与 AI 摘要。publicId 来自 aihot_hot_topics 返回的 storyPublicId。',
    parameters: {
      type: 'object',
      properties: {
        publicId: { type: 'string', description: '故事公开 ID' }
      },
      required: ['publicId']
    },
    risk: 'safe',
    handler: async (...params: unknown[]) =>
      runAihot('获取事件时间线', async () => {
        const { publicId } = params[0] as { publicId: string }
        return (await aihotApiV1Stories(publicId)).story
      })
  },
  {
    name: 'aihot_daily',
    label: 'AIHOT 日报',
    description:
      '获取 AIHOT 日报全文（每日 08:00 上海时间生成，含导语、分栏条目与快讯）。不传 date 取最新一期；需要查看有哪些日期时先用 aihot_dailies。',
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
    name: 'aihot_dailies',
    label: 'AIHOT 日报索引',
    description:
      '获取 AIHOT 日报归档索引（按日期最新在前，仅含日期与导语摘要）。用于了解有哪些日期的日报，再用 aihot_daily 按日期取全文。',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '返回期数（1–180，默认 30）' }
      }
    },
    risk: 'safe',
    handler: async (...params: unknown[]) =>
      runAihot('获取日报索引', async () => {
        const { limit } = params[0] as { limit?: number }
        return aihotApiV1Dailies(Math.min(Math.max(Math.floor(limit ?? 30), 1), 180))
      })
  },
  {
    name: 'aihot_selected_snapshot',
    label: 'AIHOT 精选集快照',
    description:
      '获取 AIHOT 精选集全量快照（只增不减的策展库，共数千条，分页返回）。用于一次性引导完整镜像：持续用返回的 nextPage 翻页直到 hasMore=false，并保留第一页返回的 cursor 供 aihot_selected_changes 增量同步。',
    parameters: {
      type: 'object',
      properties: {
        fields: {
          type: 'string',
          enum: ['default', 'minimal'],
          description: 'default=完整字段，minimal=约省 4 倍体积'
        },
        limit: { type: 'number', description: '每页条数（1–1000，默认 500）' },
        page: { type: 'string', description: '续页游标（上一页返回的 nextPage）' }
      }
    },
    risk: 'safe',
    handler: async (...params: unknown[]) =>
      runAihot('获取精选集快照', async () => {
        const { fields, limit, page } = params[0] as {
          fields?: 'default' | 'minimal'
          limit?: number
          page?: string
        }
        return aihotApiV1SelectedSnapshot({ fields, limit, page })
      })
  },
  {
    name: 'aihot_selected_changes',
    label: 'AIHOT 精选集增量变更',
    description:
      '获取 AIHOT 精选集自指定游标之后的原子变更（upsert / remove）。cursor 来自 aihot_selected_snapshot 第一页返回值；返回 409 snapshot_required 表示游标失效，需重新引导快照。',
    parameters: {
      type: 'object',
      properties: {
        cursor: { type: 'string', description: '账本水位游标（snapshot 首页返回的 cursor）' },
        limit: { type: 'number', description: '返回条数（1–100，默认 100）' }
      },
      required: ['cursor']
    },
    risk: 'safe',
    handler: async (...params: unknown[]) =>
      runAihot('获取精选集变更', async () => {
        const { cursor, limit } = params[0] as { cursor: string; limit?: number }
        return aihotApiV1SelectedChanges({ cursor, limit })
      })
  }
]
