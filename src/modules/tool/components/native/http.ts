import { ToolFunction, HttpRequestMethod } from '@/domain'
import { requestText, requestDownload } from '@/plugin/http'
import { useSettingSecureStore } from '@/store/setting/SettingSecureStore'
import { isDomainBlocked } from '@/utils/sandbox'

function getHostname(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname
  } catch {
    return ''
  }
}

/** 校验域名是否被网络安全策略拦截，返回拦截原因（未拦截返回 undefined） */
function getDomainBlockReason(url: string): string | undefined {
  const store = useSettingSecureStore()
  const { sandbox } = store.state
  if (!sandbox.enabled) return undefined
  const hostname = getHostname(url)
  if (!hostname) return undefined
  const { blocked, reason } = isDomainBlocked(
    hostname,
    sandbox.blockAllNetworkAccess,
    sandbox.allowDomain,
    sandbox.rejectDomain
  )
  return blocked ? reason : undefined
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
    risk: 'safe',
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

      const reason = getDomainBlockReason(url)
      if (reason) return { error: reason }

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
  },
  {
    name: 'http_download',
    label: '下载文件',
    description:
      '从 url 下载二进制文件（图片、音视频等）保存到指定路径，遵守网络安全策略；保存到沙盒/工作空间自动放行，其他目录需用户确认',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '要下载的文件 URL'
        },
        path: {
          type: 'string',
          description: '保存路径（含文件名），建议保存到沙盒 outputs/ 目录；父目录不存在会自动创建'
        }
      },
      required: ['url', 'path']
    },
    risk: 'sensitive',
    handler: async (...params: unknown[]) => {
      const { url, path } = params[0] as { url: string; path: string }
      const reason = getDomainBlockReason(url)
      if (reason) return { error: reason }
      await window.preload.fs.mkdir(window.preload.path.dirname(path), true)
      await requestDownload({ url }, path)
      return { success: true, path }
    }
  }
]
