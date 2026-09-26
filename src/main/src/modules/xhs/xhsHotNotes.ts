/**
 * 小红书热点取数（main 进程）：TS 重写自 xhs-Skills 的 Python 脚本
 * fetch_xhs_hot_articles.py，数据源为红狐 API（redfox.hk）。返回结构化数据供 AI 解读。
 *
 * 请求走通用 axios 客户端（appAxios，代理 / UA / TLS 策略随网络设置）；
 * 鉴权 Key 由渲染层随请求传入（设置里的凭证是唯一真源，main 侧不留存、不落盘）。
 */
import { appAxios } from '../network/appAxios'
import type {
  XhsHotNote,
  XhsHotNotesRequest,
  XhsHotNotesResponse,
  XhsKeywordResult
} from '@common/types/xhs'

const API_URL = 'https://redfox.hk/story/api/xhs/search/search'
/** 源接口成功码（非 2000 一律按接口错误处理，msg 透出） */
const SUCCESS_CODE = 2000
/** 源接口固定来源标识（与源脚本一致） */
const SOURCE = '小红书爆款笔记洞察-SkillHub'
const REQUEST_TIMEOUT_MS = 30_000
const MAX_RETRIES = 2
const MAX_KEYWORDS = 3
const MAX_PAGE_SIZE = 50
const MAX_DAYS = 30
const MAX_ITEMS = 20

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9'
}

/** 源接口单条笔记（字段可能缺失，均按可选处理） */
interface RawNote {
  id?: unknown
  title?: unknown
  desc?: unknown
  createTime?: unknown
  cover?: unknown
  shareInfoLink?: unknown
  authorId?: unknown
  authorNickname?: unknown
  authorFans?: unknown
  likedCount?: unknown
  collectedCount?: unknown
  commentsCount?: unknown
  sharedCount?: unknown
  interactiveCount?: unknown
  popularityScore?: unknown
  recencyScore?: unknown
  relevanceScore?: unknown
  totalScore?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toNumber = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : 0
}

const toText = (value: unknown): string =>
  typeof value === 'string' ? value : value == null ? '' : String(value)

/** 源接口可能不返回 fans（缺失用 null 区分「未知」与「0」） */
const toOptionalNumber = (value: unknown): number | null =>
  value == null || value === '' ? null : toNumber(value)

const noteLinkOf = (raw: RawNote): string => {
  const link = toText(raw.shareInfoLink)
  if (link) return link
  const id = toText(raw.id)
  return id ? `https://www.xiaohongshu.com/explore/${id}` : ''
}

const normalizeNote = (raw: RawNote): XhsHotNote => {
  const likedCount = toNumber(raw.likedCount)
  const collectedCount = toNumber(raw.collectedCount)
  const commentsCount = toNumber(raw.commentsCount)
  const sharedCount = toNumber(raw.sharedCount)
  return {
    noteId: toText(raw.id),
    title: toText(raw.title),
    desc: toText(raw.desc),
    createTime: toText(raw.createTime),
    cover: toText(raw.cover),
    noteLink: noteLinkOf(raw),
    authorLink: toText(raw.authorId)
      ? `https://www.xiaohongshu.com/user/profile/${toText(raw.authorId)}`
      : '',
    authorNickname: toText(raw.authorNickname),
    authorFans: toOptionalNumber(raw.authorFans),
    likedCount,
    collectedCount,
    commentsCount,
    sharedCount,
    interactiveCount:
      toNumber(raw.interactiveCount) || likedCount + collectedCount + commentsCount + sharedCount,
    totalScore: toNumber(raw.totalScore),
    popularityScore: toNumber(raw.popularityScore),
    relevanceScore: toNumber(raw.relevanceScore),
    recencyScore: toNumber(raw.recencyScore)
  }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value)))

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** 回看 N 天的起始日期（源接口按 yyyy-MM-dd 过滤，endDate 留空表示不限） */
const buildStartDate = (days: number): string => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 查询单个关键词（含重试），返回归一化并按 totalScore 降序的条目 */
const fetchKeyword = async (
  apiKey: string,
  keyword: string,
  options: { startDate: string; pageSize: number; maxItems: number }
): Promise<XhsKeywordResult> => {
  let lastError = ''
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await appAxios.post<unknown>(
        API_URL,
        {
          keyword,
          pageNum: 1,
          pageSize: options.pageSize,
          startDate: options.startDate,
          endDate: '',
          source: SOURCE
        },
        {
          timeout: REQUEST_TIMEOUT_MS,
          headers: {
            ...REQUEST_HEADERS,
            'Content-Type': 'application/json',
            'X-API-KEY': apiKey
          },
          // 4xx/5xx 也进正常分支按状态抛错，避免走 reject 打乱重试逻辑
          validateStatus: () => true
        }
      )
      if (response.status >= 400) throw new Error(`HTTP ${response.status}`)
      const payload: unknown = response.data
      if (!isRecord(payload)) throw new Error('响应非 JSON 对象')
      if (payload.code !== SUCCESS_CODE) {
        throw new Error(`接口错误：${toText(payload.msg) || `code=${toText(payload.code)}`}`)
      }
      const data = isRecord(payload.data) ? payload.data : {}
      const articles = Array.isArray(data.articles) ? (data.articles as RawNote[]) : []
      const related = Array.isArray(data.relatedSearches)
        ? data.relatedSearches.filter((word): word is string => typeof word === 'string')
        : []
      return {
        keyword: toText(data.keyword) || keyword,
        // 源接口 total 为命中总数，缺失时退化为本页条数
        total: toNumber(data.total) || articles.length,
        relatedSearches: related,
        items: articles
          .map(normalizeNote)
          .sort((a, b) => b.totalScore - a.totalScore)
          .slice(0, options.maxItems)
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
    if (attempt < MAX_RETRIES) await sleep(1000 * 2 ** attempt)
  }
  throw new Error(lastError || '请求失败')
}

/** 入口：逐关键词取数（单关键词失败只记 errors，不影响其余） */
export const fetchXhsHotNotes = async (
  req: XhsHotNotesRequest
): Promise<XhsHotNotesResponse> => {
  const apiKey = (req.apiKey ?? '').trim()
  if (!apiKey) {
    return { errors: ['未配置红狐 API Key：请在「设置 → 账号 → 第三方账号」填写'] }
  }
  const keywords = Array.from(
    new Set((req.keywords ?? []).map((k) => k.trim()).filter(Boolean))
  ).slice(0, MAX_KEYWORDS)
  if (!keywords.length) return { errors: ['keywords 不能为空'] }

  const options = {
    startDate: buildStartDate(clamp(req.days ?? MAX_DAYS, 1, MAX_DAYS)),
    pageSize: clamp(req.pageSize ?? MAX_PAGE_SIZE, 1, MAX_PAGE_SIZE),
    maxItems: clamp(req.maxItems ?? 10, 1, MAX_ITEMS)
  }

  const results: XhsKeywordResult[] = []
  const errors: string[] = []
  for (const keyword of keywords) {
    try {
      results.push(await fetchKeyword(apiKey, keyword, options))
    } catch (e) {
      errors.push(`${keyword}：${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { results: results.length ? results : undefined, errors }
}
