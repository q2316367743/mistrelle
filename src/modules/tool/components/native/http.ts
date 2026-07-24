import { ToolFunction, HttpRequestMethod } from '@/domain'
import { requestText } from '@/plugin/http'
import { useSettingSecureStore } from '@/store/setting/SettingSecureStore'
import { isDomainBlocked } from '@/utils/sandbox'

function getHostname(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname
  } catch {
    return ''
  }
}

export const nativeHttpTools: ToolFunction[] = [
  {
    name: 'http_request',
    label: '执行 http 请求',
    description:
      'Execute an HTTP request with customizable method, headers, body, query params, timeout, and encoding. Respects the security center\'s network access policy (domain allow/block lists).',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to make the request to'
        },
        method: {
          type: 'string',
          description: 'HTTP method (GET, POST, PUT, DELETE, HEAD). Default is GET'
        },
        headers: {
          type: 'object',
          description: 'HTTP request headers as key-value pairs'
        },
        data: {
          type: 'string',
          description: 'Request body data (used for POST/PUT requests)'
        },
        params: {
          type: 'object',
          description: 'URL query parameters as key-value pairs'
        },
        timeout: {
          type: 'number',
          description: 'Request timeout in milliseconds. Default is 30000'
        },
        charset: {
          type: 'string',
          description: 'Response encoding charset. Auto-detected if not specified'
        }
      },
      required: ['url']
    },
    requireConfirm: true,
    handler: async (...params: unknown[]) => {
      const {
        url,
        method,
        headers,
        data,
        params: queryParams,
        timeout,
        charset
      } = params[0] as {
        url: string
        method?: string
        headers?: Record<string, string>
        data?: string
        params?: Record<string, string>
        timeout?: number
        charset?: string
      }

      const store = useSettingSecureStore()
      const { sandbox } = store.state
      if (sandbox.enabled) {
        const hostname = getHostname(url)
        if (hostname) {
          const { blocked, reason } = isDomainBlocked(
            hostname,
            sandbox.blockAllNetworkAccess,
            sandbox.allowDomain,
            sandbox.rejectDomain
          )
          if (blocked) return { error: reason }
        }
      }

      const { data: responseData } = await requestText({
        url,
        method: method as HttpRequestMethod,
        headers,
        data,
        params: queryParams,
        timeout,
        charset
      })
      return responseData
    }
  }
]
