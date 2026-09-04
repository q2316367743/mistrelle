import type { ToolFunction } from '@/domain'
import { requestJson } from '@/plugin/http'
import { useSettingAccountStore } from '@/windows/main/store'
import { useSettingSecureStore } from '@/windows/main/store/setting/SettingSecureStore'
import { isDomainBlocked } from '@/utils/sandbox'

const ZHIHU_SEARCH_URL = 'https://developer.zhihu.com/api/v1/content/zhihu_search'
const ANY_SEARCH_URL = 'https://api.anysearch.com/v1/search'

interface ZhihuSearchItem {
  Title: string
  ContentType: string
  ContentID: string
  ContentText: string
  Url: string
  CommentCount: number
  VoteUpCount: number
  AuthorName: string
  EditTime: number
  AuthorityLevel: string
  RankingScore: number
}

interface ZhihuSearchResponse {
  Code: number
  Message: string
  Data?: {
    HasMore: boolean
    SearchHashId: string
    Items: ZhihuSearchItem[]
    EmptyReason?: string
  }
}

interface AnySearchResult {
  title: string
  url: string
  snippet: string
  content: string
}

interface AnySearchResponse {
  code: number
  message?: string
  request_id?: string
  data?: {
    results: AnySearchResult[]
    metadata: {
      total_results?: number
      search_time_ms?: number
    }
  }
}

function getDomainBlockReason(hostname: string): string | undefined {
  const { sandbox } = useSettingSecureStore().state
  if (!sandbox.enabled) return undefined
  const { blocked, reason } = isDomainBlocked(
    hostname,
    sandbox.blockAllNetworkAccess,
    sandbox.allowDomain,
    sandbox.rejectDomain
  )
  return blocked ? reason : undefined
}

const zhihuSearchTool: ToolFunction = {
  name: 'zhihu_search',
  label: '知乎搜索',
  description:
    'Search Zhihu (知乎) for questions, answers, and articles related to a query. ' +
    'Requires Access Secret configured in Account Settings (知乎数据开放平台). ' +
    'Returns titles, snippets, URLs, vote/comment counts, and author info. ' +
    'Use when the user needs Chinese community knowledge, Q&A, or Zhihu-sourced material.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search keywords (cannot be empty)'
      },
      count: {
        type: 'number',
        description: 'Number of results to return. Default 10, max 10'
      }
    },
    required: ['query']
  },
  risk: 'safe',
  handler: async (...params: unknown[]) => {
    const { query, count } = params[0] as { query: string; count?: number }
    if (!query?.trim()) return { error: 'query 不能为空' }

    const account = useSettingAccountStore()
    const reason = getDomainBlockReason('developer.zhihu.com')
    if (reason) return { error: reason }

    const res = await requestJson<ZhihuSearchResponse>({
      url: ZHIHU_SEARCH_URL,
      method: 'GET',
      params: {
        Query: query.trim(),
        ...(count !== undefined ? { Count: count } : {})
      },
      ...account.zhihuConfig()
    })

    if (res.data.Code !== 0) {
      return { error: res.data.Message || `知乎搜索失败，Code=${res.data.Code}` }
    }

    const data = res.data.Data
    if (!data) return { error: '知乎搜索返回空数据' }

    return {
      hasMore: data.HasMore,
      searchHashId: data.SearchHashId,
      emptyReason: data.EmptyReason,
      count: data.Items.length,
      items: data.Items.map((item) => ({
        title: item.Title,
        contentType: item.ContentType,
        contentId: item.ContentID,
        contentText: item.ContentText,
        url: item.Url,
        commentCount: item.CommentCount,
        voteUpCount: item.VoteUpCount,
        authorName: item.AuthorName,
        editTime: item.EditTime,
        authorityLevel: item.AuthorityLevel,
        rankingScore: item.RankingScore
      }))
    }
  }
}

const anySearchTool: ToolFunction = {
  name: 'any_search',
  label: 'AnySearch 搜索',
  description:
    'Unified web / vertical search via AnySearch (https://api.anysearch.com). ' +
    'Works without an API key (anonymous daily quota, IP rate-limited). ' +
    'Optional tag routes to a vertical capability (e.g. "code.doc", "finance.news", "general.general"). ' +
    'Use for general web search or structured domain queries; ONE intent per call.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query. ONE intent per call'
      },
      max_results: {
        type: 'number',
        description: 'Number of results to return. Default 10, range 1–20'
      },
      tag: {
        type: 'string',
        description:
          'Optional sub-domain capability tag as "{domain}.{sub_domain}", e.g. "code.doc", "finance.quote", "general.general"'
      },
      zone: {
        type: 'string',
        description: 'Region: "cn" or "intl"'
      },
      language: {
        type: 'string',
        description: 'Preferred language, e.g. "zh-CN" or "en"'
      },
      params: {
        type: 'object',
        description:
          'Extended parameters for the selected tag, e.g. {"library": "golang"} for code.doc. Do not invent keys.'
      },
      format: {
        type: 'string',
        description: 'Output format: "json" (default) or "markdown"'
      }
    },
    required: ['query']
  },
  risk: 'safe',
  handler: async (...params: unknown[]) => {
    const {
      query,
      max_results,
      tag,
      zone,
      language,
      params: tagParams,
      format
    } = params[0] as {
      query: string
      max_results?: number
      tag?: string
      zone?: string
      language?: string
      params?: Record<string, unknown>
      format?: string
    }

    if (!query?.trim()) return { error: 'query 不能为空' }

    const reason = getDomainBlockReason('api.anysearch.com')
    if (reason) return { error: reason }

    const body: Record<string, unknown> = { query: query.trim() }
    if (max_results !== undefined) body.max_results = max_results
    if (tag) body.tag = tag
    if (zone) body.zone = zone
    if (language) body.language = language
    if (tagParams) body.params = tagParams
    if (format) body.format = format

    const res = await requestJson<AnySearchResponse>({
      url: ANY_SEARCH_URL,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: body
    })

    if (res.data.code !== 0) {
      return {
        error: res.data.message || `AnySearch 失败，code=${res.data.code}`,
        requestId: res.data.request_id
      }
    }

    const data = res.data.data
    if (!data) return { error: 'AnySearch 返回空数据', requestId: res.data.request_id }

    return {
      requestId: res.data.request_id,
      metadata: data.metadata,
      count: data.results.length,
      results: data.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        content: r.content
      }))
    }
  }
}

/**
 * 搜索类原生工具（动态）：
 * - any_search：始终可用（可匿名）
 * - zhihu_search：仅当账号设置中配置了知乎 Access Secret 时注入
 */
export function getNativeSearchTools(): ToolFunction[] {
  const tools: ToolFunction[] = [anySearchTool]
  if (useSettingAccountStore().state.zhihu) {
    tools.push(zhihuSearchTool)
  }
  return tools
}
