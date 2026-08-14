import { HttpRequest, HttpResponse } from '@/domain'
import { AxiosRequestConfig, AxiosResponse } from 'axios'
import { useSettingNetworkStore } from '@/store'
import { useLog } from '@/hooks/UseLog'
import { nonNullObj } from '@/utils/lang'

const logger = useLog({ name: 'plugin:http' })

/**
 * 从响应中检测字符编码
 * 优先级: 响应头 Content-Type > HTML meta > XML declaration > 默认 utf-8
 */
function detectCharset(response: AxiosResponse<ArrayBuffer>): string {
  const contentType = (response.headers['content-type'] as string | undefined) ?? ''

  // 1. 从响应头 Content-Type 中提取 charset
  const headerMatch = contentType.match(/charset=([\w-]+)/i)
  if (headerMatch) return headerMatch[1].toLowerCase()

  // 2-3. 根据 Content-Type 判断响应类型，针对性地从内容中提取编码
  const isHtml = contentType.includes('text/html')
  const isXml = contentType.includes('text/xml') || contentType.includes('application/xml')

  if (isHtml || isXml) {
    // 用 latin1 临时解码（单字节映射，不会丢字节），仅用于正则提取编码声明
    const rawText = new TextDecoder('latin1').decode(response.data)

    if (isHtml) {
      const match = rawText.match(/<meta[^>]+charset=([\w-]+)/i)
      if (match) return match[1].toLowerCase()
    }
    if (isXml) {
      const match = rawText.match(/<\?xml[^>]+encoding=["']([\w-]+)["']/i)
      if (match) return match[1].toLowerCase()
    }
  }

  // 4. 兜底默认 utf-8
  return 'utf-8'
}

/**
 * 转换请求配置，并加入网络代理与 User-Agent
 * @param config 请求配置
 */
function httpRequestToAxiosConfig(config: HttpRequest): AxiosRequestConfig {
  const { fillAxiosConfig } = useSettingNetworkStore()
  const {
    baseURL = '',
    timeout = 30000,
    headers = {},
    data,
    params,
    url,
    method = 'GET',
    cookie,
    signal,
    onDownloadProgress
  } = config
  const _config: AxiosRequestConfig = {
    baseURL,
    url,
    method,
    timeout,
    headers,
    data,
    params,
    signal,
    onDownloadProgress,
    responseType: 'arraybuffer'
  }

  // 应用全局网络设置
  fillAxiosConfig(_config)
  nonNullObj(_config)
  if (!_config.headers) {
    _config.headers = {}
  }
  if (!_config.headers['User-Agent']) {
    _config.headers['User-Agent'] = navigator.userAgent
  }
  // 补全 Cookie
  if (cookie) {
    _config.headers['Cookie'] = _config.headers['Cookie']
      ? `${_config.headers['Cookie']};${cookie}`
      : cookie
  }
  return _config
}

// 用于日志打印
async function requestBase<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
  logger.debug(`发起请求: ${config.method} ${config.baseURL || ''}${config.url}`, config)
  try {
    const response = await window.preload.axios<T>(config)

    logger.debug(`请求成功: ${config.method} ${config.baseURL || ''}${config.url}`, {
      status: response.status,
      headers: response.headers
    })
    return response
  } catch (e) {
    logger.error(`请求失败: ${config.method} ${config.baseURL || ''}${config.url}`, e)
    throw e
  }
}

// ====================================== 封装方法 ======================================

/**
 * 请求获取字符串
 * @param config 请求配置
 */
export async function requestText(config: HttpRequest): Promise<HttpResponse> {
  const { charset } = config

  const response = await requestBase<ArrayBuffer>(httpRequestToAxiosConfig(config))

  let responseData: string
  if (charset) {
    // 指定编码最简单，直接转即可
    responseData = window.preload.iconv.parseArrayBuffer(response.data, charset)
  } else {
    // 未指定编码，按优先级自动检测
    const detectedCharset = detectCharset(response)
    responseData = window.preload.iconv.parseArrayBuffer(response.data, detectedCharset)
  }
  return {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    config: response.config,
    data: responseData
  }
}

export async function requestJson<T = Record<string, any>>(
  config: HttpRequest
): Promise<HttpResponse<T>> {
  const response = await requestText(config)
  return {
    ...response,
    data: JSON.parse(response.data) as T
  }
}

/**
 * 请求下载
 * @param config
 * @param path
 */
export async function requestDownload(
  config: Omit<HttpRequest, 'charset' | 'webview'>,
  path: string
): Promise<void> {
  const _config = httpRequestToAxiosConfig(config)
  return window.preload.net.downloadFileFromUrl(_config, path)
}

// ====================================== 流式请求 ======================================

export interface StreamRequestOptions extends HttpRequest {
  signal?: AbortSignal
}

export interface StreamResponse {
  status: number
  headers: Record<string, string>
  /**
   * 响应体原始字节流（经 preload 桥逐块转发，块边界与内容无关，需自行分帧解析）
   */
  stream: AsyncIterable<Uint8Array>
}

/**
 * 发起流式请求（SSE / 任意字节流）。
 * - 走 preload 的 Node http 适配器，免疫渲染层 CORS。
 * - 返回的 stream 是惰性迭代器：调用方 break / return 提前退出时会自动取消底层请求；
 *   config.signal abort 同样触发取消。
 * - 非 2xx 状态也照常流入 stream，调用方需自行校验 status。
 */
export async function requestStream(config: StreamRequestOptions): Promise<StreamResponse> {
  const { signal, ...rest } = config
  const _config = httpRequestToAxiosConfig(rest)
  _config.responseType = 'stream'

  let infoResolved = false
  let resolveInfo!: (info: {
    requestId: string
    status: number
    headers: Record<string, string>
  }) => void
  let rejectInfo!: (error: unknown) => void
  const infoPromise = new Promise<{
    requestId: string
    status: number
    headers: Record<string, string>
  }>((resolve, reject) => {
    resolveInfo = resolve
    rejectInfo = reject
  })

  const queue: Uint8Array[] = []
  let waiter: (() => void) | null = null
  let settled = false
  let streamError: unknown = null

  const wake = (): void => {
    if (waiter) {
      const pending = waiter
      waiter = null
      pending()
    }
  }

  const donePromise = window.preload.aiStream.streamRequest(
    _config as unknown as Record<string, unknown>,
    {
      onStart: (info) => {
        infoResolved = true
        resolveInfo(info)
      },
      onChunk: (chunk) => {
        queue.push(new Uint8Array(chunk))
        wake()
      }
    }
  )
  donePromise.then(
    () => {
      settled = true
      wake()
    },
    (error: unknown) => {
      settled = true
      streamError = error
      if (!infoResolved) rejectInfo(error)
      wake()
    }
  )

  const info = await infoPromise

  // 取消信号：外部 abort 时取消底层请求（流正常结束后由 donePromise 收尾，不再响应）
  if (signal) {
    if (signal.aborted) {
      window.preload.aiStream.streamAbort(info.requestId)
    } else {
      signal.addEventListener('abort', () => window.preload.aiStream.streamAbort(info.requestId), {
        once: true
      })
    }
  }

  async function* generate(): AsyncGenerator<Uint8Array> {
    try {
      for (;;) {
        if (queue.length > 0) {
          yield queue.shift() as Uint8Array
          continue
        }
        if (settled) break
        await new Promise<void>((resolve) => {
          waiter = resolve
        })
      }
      if (streamError) throw streamError
    } finally {
      // 消费方提前退出（break / return / 异常）时取消底层请求，避免悬挂
      if (!settled) window.preload.aiStream.streamAbort(info.requestId)
    }
  }

  return { status: info.status, headers: info.headers, stream: generate() }
}

// ====================================== 包装方法 ======================================

export function useHead(url: string, params?: Record<string, unknown>, config?: HttpRequest) {
  return requestText({
    url,
    params,
    ...config,
    method: 'HEAD'
  })
}

export function useGet<T = unknown>(
  url: string,
  params?: Record<string, unknown>,
  config?: HttpRequest
) {
  return requestJson<T>({
    url,
    params,
    ...config,
    method: 'GET'
  })
}

export function usePost<T = unknown>(
  url: string,
  data?: Record<string, unknown> | FormData,
  config?: HttpRequest
) {
  return requestJson<T>({
    url,
    ...config,
    data,
    method: 'POST'
  })
}
