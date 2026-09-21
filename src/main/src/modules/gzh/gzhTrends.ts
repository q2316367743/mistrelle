/**
 * 公众号爆款数据抓取（main 进程）：TS 重写自 gzh-Skills 的两个 Python 脚本
 * （fetch_gzh_trends.py 四榜模式 + daily_sector_trends.py 赛道模式），数据源同为
 * onetotenvip.com 的 SkillHub 接口，返回结构化数据供 AI 解读（HTML 报告不再生成）。
 *
 * 请求走通用 axios 客户端（appAxios，代理 / UA / TLS 策略随网络设置）；失败回退原生
 * socket no-SNI 裸握手（原 Python 脚本的非常规路径，axios 无法控制 servername）。
 */
import https from 'node:https'
import { gunzipSync } from 'node:zlib'
import { appAxios } from '../network/appAxios'
import type {
  GzhKeywordResult,
  GzhSectorResult,
  GzhTrendArticle,
  GzhTrendsRequest,
  GzhTrendsResponse
} from '@common/types/gzhTrends'

const API_HOST = 'onetotenvip.com'
const API_PATH = '/skill/cozeSkill/getWxCozeSkillData'
const REQUEST_TIMEOUT_MS = 30_000
const MAX_RETRIES = 2

/** 四榜原始键 → 中文名（与源接口字段一一对应） */
const BOARDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'lowPowderExplosiveArticle', label: '低粉高阅读' },
  { key: 'tenWReadingRank', label: '阅读靠前' },
  { key: 'oneWReadingRank', label: '数据增长中' },
  { key: 'originalRank', label: '原创靠前' }
]

/** 源接口返回的单条文章（字段可能缺失，均按可选处理） */
interface RawTrendItem {
  title?: string
  summary?: string
  photoId?: string
  accountId?: string
  accountName?: string
  fans?: string | number
  publicTime?: string
  oriUrl?: string
  noteLink?: string
  coverUrl?: string
  interactiveCount?: string | number
  likeCount?: string | number
  useCommentCount?: string | number
  commentCount?: string | number
  shareCount?: string | number
  clicksCount?: string | number
  watchCount?: string | number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** "1.5w" / "17w+" / "3,200" / 1200 → number（与原 parse_count 同规则） */
const parseCount = (value: string | number | undefined): number => {
  if (value === undefined || value === null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  let text = value.replace(/\+|,/g, '').trim()
  if (/w/i.test(text)) {
    const num = parseFloat(text.replace(/w/i, ''))
    return Number.isFinite(num) ? Math.round(num * 10000) : 0
  }
  const num = parseFloat(text)
  return Number.isFinite(num) ? num : 0
}

const log10 = (n: number): number => (n > 0 ? Math.log10(n) : 0)

/** 通用数据分（对数加权，封顶 100，与原 score_item 同权重） */
const scoreItem = (item: GzhTrendArticle): number => {
  const score =
    log10(parseCount(item.reads) + 1) * 18 +
    log10(item.shares + 1) * 22 +
    log10(item.likes + 1) * 16 +
    log10(item.comments + 1) * 14 +
    log10(item.interactive + 1) * 10
  return Math.round(Math.min(100, score) * 100) / 100
}

const safeUrl = (raw: string, photoId: string): string => {
  const candidate = (raw || '').trim()
  if (/^https:\/\/[^\s"'<>]+$/i.test(candidate)) return candidate
  return photoId ? `https://mp.weixin.qq.com/s/${photoId}` : ''
}

const normalizeItem = (
  raw: RawTrendItem,
  boardLabel: string,
  keyword: string
): GzhTrendArticle => {
  const title = (raw.title ?? '').trim()
  const summary = (raw.summary ?? '').trim()
  const photoId = (raw.photoId ?? '').trim()
  const fans = raw.fans
  const item: GzhTrendArticle = {
    category: boardLabel,
    keyword,
    title: title || summary.slice(0, 42) || '无标题',
    accountName: (raw.accountName ?? '').trim(),
    fans: fans === undefined ? '' : String(fans),
    publicTime: (raw.publicTime ?? '').trim(),
    link: safeUrl(raw.oriUrl ?? raw.noteLink ?? '', photoId),
    reads: raw.clicksCount === undefined ? '0' : String(raw.clicksCount),
    likes: parseCount(raw.likeCount),
    comments: parseCount(raw.useCommentCount ?? raw.commentCount),
    shares: parseCount(raw.shareCount),
    interactive: parseCount(raw.interactiveCount),
    score: 0
  }
  item.score = scoreItem(item)
  // 榜单特化加分（与原 calculate_data_score 一致）：万粉以下爆款 / 10w+ 阅读
  if (boardLabel === '低粉高阅读') {
    const fansNum = parseCount(item.fans)
    if (fansNum > 0 && fansNum < 10000) item.score = Math.min(100, item.score + 8)
    else if (fansNum > 0 && fansNum < 50000) item.score = Math.min(100, item.score + 5)
  } else if (boardLabel === '阅读靠前' && parseCount(item.reads) >= 100000) {
    item.score = Math.min(100, item.score + 10)
  }
  return item
}

const dedupe = (items: GzhTrendArticle[]): GzhTrendArticle[] => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = item.link || `${item.title}:${item.accountName}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** 跨榜合并：按分数降序后从各榜轮选取样，保证榜单多样性（与原 ensure_category_diversity 同思路） */
const mergeBoards = (items: GzhTrendArticle[], maxItems: number): GzhTrendArticle[] => {
  const byBoard = new Map<string, GzhTrendArticle[]>()
  for (const item of [...items].sort((a, b) => b.score - a.score)) {
    const list = byBoard.get(item.category) ?? []
    list.push(item)
    byBoard.set(item.category, list)
  }
  const result: GzhTrendArticle[] = []
  while (result.length < maxItems) {
    let added = false
    for (const list of byBoard.values()) {
      const next = list.shift()
      if (next) {
        result.push(next)
        added = true
        if (result.length >= maxItems) break
      }
    }
    if (!added) break
  }
  return result
}

interface HttpResult {
  status: number
  body: string
}

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  'Accept-Encoding': 'identity'
}

/** 主路径：通用 axios 客户端（代理 / TLS 策略随网络设置；证书校验由 ignoreTlsCertError 默认关闭覆盖） */
const axiosGet = async (path: string): Promise<HttpResult> => {
  const response = await appAxios.get<string>(`https://${API_HOST}${path}`, {
    responseType: 'text',
    timeout: REQUEST_TIMEOUT_MS,
    headers: REQUEST_HEADERS,
    // 404/5xx 也进正常分支按 HTTP 状态抛错，避免走 reject 打乱重试逻辑
    validateStatus: () => true
  })
  return { status: response.status, body: response.data }
}

/** 兜底：原生 socket no-SNI 握手（原 Python 脚本的非常规路径，axios 做不到 servername 控制） */
const httpsGetNoSni = (path: string): Promise<HttpResult> =>
  new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: API_HOST,
        port: 443,
        path,
        method: 'GET',
        servername: '',
        rejectUnauthorized: false,
        timeout: REQUEST_TIMEOUT_MS,
        headers: { Host: API_HOST, ...REQUEST_HEADERS, Connection: 'close' }
      },
      (res) => {
        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > 8 * 1024 * 1024) {
            req.destroy()
            reject(new Error('响应体超过 8MB，已中断'))
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () => {
          let body = Buffer.concat(chunks)
          if ((res.headers['content-encoding'] ?? '').includes('gzip')) {
            try {
              body = gunzipSync(body)
            } catch {
              // 解压失败按原样处理
            }
          }
          resolve({ status: res.statusCode ?? 0, body: body.toString('utf-8') })
        })
      }
    )
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('请求超时'))
    })
    req.on('error', reject)
    req.end()
  })

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** 查询单个关键词的源数据（含 no-SNI 回退与重试），返回四榜原始条目 */
const fetchKeywordRaw = async (
  keyword: string,
  startDate?: string
): Promise<Record<string, RawTrendItem[]>> => {
  const params = new URLSearchParams({
    keyword,
    source: '公众号爆款文章洞察-SkillHub'
  })
  if (startDate) params.set('startDate', startDate)
  const path = `${API_PATH}?${params.toString()}`

  let lastError = ''
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // 主路径 axios（走代理 / 网络设置）→ 失败回退 no-SNI 裸握手（源站非常规 TLS 的兜底）
    for (const fetchOnce of [axiosGet, httpsGetNoSni]) {
      try {
        const { status, body } = await fetchOnce(path)
        if (status >= 400) throw new Error(`HTTP ${status}`)
        const parsed: unknown = JSON.parse(body)
        if (!isRecord(parsed) || !isRecord(parsed.data)) {
          throw new Error(`接口错误：${isRecord(parsed) ? String(parsed.msg ?? '未知') : '响应非 JSON'}`)
        }
        const data = parsed.data
        const boards: Record<string, RawTrendItem[]> = {}
        for (const board of BOARDS) {
          const list = data[board.key]
          boards[board.key] = Array.isArray(list) ? (list as RawTrendItem[]) : []
        }
        return boards
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e)
      }
    }
    if (attempt < MAX_RETRIES) await sleep(1000 * 2 ** attempt)
  }
  throw new Error(lastError || '请求失败')
}

const toArticles = (
  boards: Record<string, RawTrendItem[]>,
  keyword: string
): GzhTrendArticle[] =>
  BOARDS.flatMap((board) =>
    (boards[board.key] ?? []).map((raw) => normalizeItem(raw, board.label, keyword))
  )

const buildStartDate = (days: number): string => {
  const date = new Date(Date.now() - days * 24 * 3600 * 1000)
  return date.toISOString().slice(0, 10)
}

const runKeywordMode = async (req: GzhTrendsRequest, startDate?: string) => {
  const results: GzhKeywordResult[] = []
  const errors: string[] = []
  const maxItems = req.maxItems ?? 10
  for (const keyword of req.keywords) {
    try {
      const boards = await fetchKeywordRaw(keyword, startDate)
      const perBoard = BOARDS.map((board) => ({
        key: board.key,
        label: board.label,
        items: (boards[board.key] ?? [])
          .map((raw) => normalizeItem(raw, board.label, keyword))
          .sort((a, b) => b.score - a.score)
          .slice(0, maxItems)
      }))
      const all = dedupe(toArticles(boards, keyword))
      results.push({
        keyword,
        boards: perBoard,
        merged: mergeBoards(all, maxItems)
      })
    } catch (e) {
      errors.push(`关键词「${keyword}」查询失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { keywordResults: results, errors }
}

const runSectorMode = async (req: GzhTrendsRequest, startDate?: string) => {
  const results: GzhSectorResult[] = []
  const errors: string[] = []
  const maxItems = req.maxItems ?? 10
  for (const sector of req.sectors ?? []) {
    const items: GzhTrendArticle[] = []
    let fetched = 0
    for (const keyword of sector.keywords) {
      try {
        const boards = await fetchKeywordRaw(keyword, startDate)
        const articles = toArticles(boards, keyword)
        fetched += articles.length
        items.push(...articles)
      } catch (e) {
        errors.push(`赛道「${sector.name}」关键词「${keyword}」查询失败：${e instanceof Error ? e.message : String(e)}`)
      }
    }
    results.push({
      name: sector.name,
      keywords: sector.keywords,
      items: dedupe(items)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxItems),
      totalFetched: fetched
    })
  }
  return { sectorResults: results, errors }
}

/** 入口：按模式抓取并归一化（IPC 与工具层共用） */
export const fetchGzhTrends = async (req: GzhTrendsRequest): Promise<GzhTrendsResponse> => {
  const days = Math.min(Math.max(req.days ?? 7, 1), 30)
  const startDate = buildStartDate(days)
  const keyword =
    req.mode === 'keyword' && req.keywords.length
      ? await runKeywordMode({ ...req, keywords: req.keywords.slice(0, 5) }, startDate)
      : { keywordResults: [], errors: [] }
  const sector =
    req.mode === 'sector' && req.sectors?.length
      ? await runSectorMode({ ...req, sectors: req.sectors.slice(0, 5) }, startDate)
      : { sectorResults: [], errors: [] }
  return { ...keyword, ...sector, errors: [...keyword.errors, ...sector.errors] }
}
