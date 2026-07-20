import { ToolFunction, HttpRequestMethod } from '@/domain'
import { requestText } from '@/plugin/http'

export const nativeHttpTools: ToolFunction[] = [
  {
    name: 'http_request',
    label: '执行 http 请求',
    description: 'Execute an HTTP request with customizable method, headers, body, query params, timeout, and encoding',
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
