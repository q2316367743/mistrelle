import HttpProgressEvent from './HttpProgressEvent'

export type HttpRequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD'

export interface HttpRequest<D = unknown> {
  baseURL?: string

  url: string

  method?: HttpRequestMethod

  timeout?: number

  params?: Record<string, any>

  data?: D

  headers?: Record<string, string>

  /**
   * 编码
   */
  charset?: string

  /**
   * TODO: 使用uBrowser进行请求，暂未实现
   */
  webview?: boolean

  /**
   * 下载进度
   * @param progressEvent 进度回调
   */
  onDownloadProgress?: (progressEvent: HttpProgressEvent) => void

  /**
   * 一种快捷方式，设置cookie
   */
  cookie?: string

  /**
   * 取消信号（透传到 preload 层，AbortSignal.abort 时中止请求）
   */
  signal?: AbortSignal
}
