/**
 * 小红书热门笔记取数工具：按关键词拉取近期高互动笔记，返回结构化结果供 AI 解读。
 * 取数实现位于 main 进程（xhsHotNotes.ts，统一网络出口 appAxios），本工具为薄封装。
 * 鉴权 Key 取「设置 → 账号 → 第三方账号」的红狐 API Key（唯一真源，随请求传入 main）；
 * 未配置时不注入本工具（场景侧同源门控），AI 走 any_search / browser_fetch 公开检索兜底。
 * 使用守则（泛化词闸门、爆款共性提取、数据纪律）在场景 skill xhs-hotspot 中，
 * 此处只做凭证 / 域闸校验、参数校验与结果压缩。
 */
import { ToolFunction, ToolProperty } from '@/domain'
import { useSettingAccountStore } from '@/windows/main/store'
import { getDomainBlockReason } from '../native/search'
import type { XhsHotNote } from '@common/types/xhs'

/** 红狐接口域名（域闸校验用） */
const REDFOX_HOST = 'redfox.hk'
const KEYWORDS_LIMIT = 3
const DAYS_LIMIT = 30
const ITEMS_LIMIT = 20

/** 红狐 API Key 是否已配置（场景工具注入与提示词同源门控） */
export const hasRedfoxAccess = (): boolean =>
  Boolean(useSettingAccountStore().state.redfox?.trim())

const KEYWORDS_PROPERTY: ToolProperty = {
  type: 'array',
  items: { type: 'string', description: '细分关键词' },
  description: `关键词列表（1-${KEYWORDS_LIMIT} 个，每个单独查询）。必须是平台上真实存在的细分词（如「通勤穿搭」「减脂餐」），泛化词（穿搭 / 护肤 / 美食）先用 xhs-hotspot skill 的赛道词库下切，不要自造组合词`
}

/** 压缩单条笔记为紧凑对象（工具结果最小化：只留解读必需字段） */
const compact = (item: XhsHotNote) => ({
  title: item.title,
  desc: item.desc,
  time: item.createTime,
  link: item.noteLink,
  author: item.authorNickname,
  fans: item.authorFans,
  likes: item.likedCount,
  collects: item.collectedCount,
  comments: item.commentsCount,
  shares: item.sharedCount,
  interactive: item.interactiveCount,
  score: item.totalScore,
  recency: item.recencyScore,
  cover: item.cover
})

export const xhsHotTools: ToolFunction[] = [
  {
    name: 'xhs_hot_notes',
    label: '小红书热门笔记',
    description:
      '拉取小红书近期高互动笔记（红狐数据源，需在「设置 → 账号 → 第三方账号」配置红狐 API Key）。' +
      '按 1-3 个细分关键词查询，返回每个词的命中总数、平台相关搜索词（用于二次拓词）与按综合评分降序的笔记列表' +
      '（标题 / 描述 / 发布时间 / 链接 / 作者与粉丝数 / 点赞·收藏·评论·分享·互动总数 / 综合评分与时效分 / 封面图 URL）。' +
      '用于选题判断、爆款共性提取、竞品与赛道趋势分析。评分由接口返回，不要自行计算；' +
      '数据拿不到时如实说明并降级到 any_search / browser_fetch 公开检索（结论须标注「未经数据验证」），' +
      '严禁编造互动量级、粉丝数与排名。',
    parameters: {
      type: 'object',
      properties: {
        keywords: KEYWORDS_PROPERTY,
        days: { type: 'number', description: `回看天数，默认 ${DAYS_LIMIT}，上限 ${DAYS_LIMIT}` },
        maxItems: { type: 'number', description: `每个关键词返回条数上限，默认 10，上限 ${ITEMS_LIMIT}` }
      },
      required: ['keywords']
    },
    risk: 'safe',
    handler: async (...params: unknown[]) => {
      const args = params[0] as { keywords?: unknown; days?: number; maxItems?: number }
      const apiKey = useSettingAccountStore().state.redfox?.trim()
      if (!apiKey) {
        return { error: '未配置红狐 API Key：请在「设置 → 账号 → 第三方账号」填写后再试' }
      }
      const blockReason = getDomainBlockReason(REDFOX_HOST)
      if (blockReason) return { error: `网络访问被沙盒设置拦截：${blockReason}` }
      const keywords = Array.isArray(args.keywords)
        ? args.keywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
        : []
      if (!keywords.length) return { error: 'keywords 不能为空' }

      const result = await window.preload.xhs.hotNotes({
        apiKey,
        keywords: keywords.slice(0, KEYWORDS_LIMIT),
        days: args.days,
        maxItems: args.maxItems ? Math.min(args.maxItems, ITEMS_LIMIT) : undefined
      })
      const errors = result.errors ?? []
      if (!result.results?.length) return { error: errors.join('；') || '取数失败' }
      return {
        results: result.results.map((r) => ({
          keyword: r.keyword,
          total: r.total,
          relatedSearches: r.relatedSearches,
          items: r.items.map(compact)
        })),
        errors
      }
    }
  }
]
