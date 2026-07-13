import HttpProgressEvent from './HttpProgressEvent'

export type HttpRequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface HttpRequest<D = unknown> {
  baseURL?: string

  url: string

  method?: HttpRequestMethod

  timeout?: number

  /**
   * 如果指定了 charset 则此设置无效
   */
  responseType?: 'json' | 'arraybuffer' | 'blob'

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
}
