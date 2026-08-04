import type { ToolFunction } from '@/domain'
import { requestJson, requestText } from '@/plugin/http'
import { useSettingAccountStore } from '@/store'
import { useSettingSecureStore } from '@/store/setting/SettingSecureStore'
import { isDomainBlocked } from '@/utils/sandbox'

const CONTEXT7_BASE = 'https://context7.com/api/v2'

interface SearchResultItem {
  id: string
  title: string
  description: string
  stars?: number
  totalSnippets?: number
}

/** 校验 context7.com 是否被安全中心拦截（与 nativeHttpTools 保持一致的策略校验） */
function getDomainBlockReason(): string | undefined {
  const { sandbox } = useSettingSecureStore().state
  if (!sandbox.enabled) return undefined
  const { blocked, reason } = isDomainBlocked(
    'context7.com',
    sandbox.blockAllNetworkAccess,
    sandbox.allowDomain,
    sandbox.rejectDomain
  )
  return blocked ? reason : undefined
}

/**
 * Context7 工具：代码开发类型下注入，让模型获取第三方类库最新官方文档。
 * - context7_resolve_library：按名称 / 关键字解析库，返回 Context7 库 ID
 * - context7_query_docs：按库 ID + 单一问题拉取最新文档（markdown）
 * 均为只读网络查询，标 risk: safe，计划模式下也可使用。
 * 免 key 可用（匿名额度），配置 SettingAccount.context7 后携带 Authorization 提升限流。
 */
export const context7Tools: ToolFunction[] = [
  {
    name: 'context7_resolve_library',
    label: '解析类库 ID',
    description:
      '将类库名称 / 关键字解析为 Context7 兼容的库 ID（如 /vuejs/vue）。' +
      '在调用 context7_query_docs 获取文档前必须先调用本工具定位库。' +
      '每个问题最多调用 3 次；优先选择知名库而非小众库。',
    parameters: {
      type: 'object',
      properties: {
        libraryName: {
          type: 'string',
          description: '类库名称或关键字，如 "vue"、"react"、"tailwindcss"'
        },
        query: {
          type: 'string',
          description: '辅助检索的语义描述，建议包含版本 / 用法场景，如 "composition api setup"'
        }
      },
      required: ['libraryName']
    },
    internal: true,
    risk: 'safe',
    handler: async (...params: unknown[]) => {
      const { libraryName, query } = params[0] as {
        libraryName: string
        query?: string
      }
      const reason = getDomainBlockReason()
      if (reason) return { error: reason }

      const searchParams: Record<string, string> = { libraryName }
      if (query) searchParams.query = query

      const res = await requestJson<{ results?: SearchResultItem[] }>({
        url: `${CONTEXT7_BASE}/libs/search`,
        params: searchParams,
        ...useSettingAccountStore().context7Config
      })
      const results = res.data.results ?? []
      return {
        count: results.length,
        results: results.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          stars: r.stars,
          snippets: r.totalSnippets
        }))
      }
    }
  },
  {
    name: 'context7_query_docs',
    label: '查询类库文档',
    description:
      '按 Context7 库 ID + 单一问题拉取该类库的最新官方文档（markdown 文本）。' +
      '必须在 context7_resolve_library 之后调用。' +
      '每个问题最多调用 3 次；query 必须是单一明确的概念，不要堆砌多个不相关问题。',
    parameters: {
      type: 'object',
      properties: {
        libraryId: {
          type: 'string',
          description: 'Context7 库 ID（来自 context7_resolve_library 的 results[].id），如 /vuejs/vue'
        },
        query: {
          type: 'string',
          description: '单一明确的问题 / 概念，如 "how to use ref with TypeScript"'
        }
      },
      required: ['libraryId', 'query']
    },
    internal: true,
    risk: 'safe',
    handler: async (...params: unknown[]) => {
      const { libraryId, query } = params[0] as {
        libraryId: string
        query: string
      }
      const reason = getDomainBlockReason()
      if (reason) return { error: reason }

      const res = await requestText({
        url: `${CONTEXT7_BASE}/context`,
        params: { libraryId, query },
        ...useSettingAccountStore().context7Config
      })
      return res.data
    }
  }
]
