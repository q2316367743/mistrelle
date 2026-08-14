/**
 * AI 流式请求桥类型（window.preload.aiStream）。
 * 与 preload/src/aiStream.ts 的 aiStreamApi 对应；只做字节转发，协议解析在渲染层 modules/ai。
 */
export interface AiStreamInfo {
  requestId: string
  status: number
  headers: Record<string, string>
}

export interface AiStreamHandlers {
  onStart?: (info: AiStreamInfo) => void
  onChunk?: (chunk: ArrayBuffer) => void
}

export interface AiStreamApi {
  /**
   * 发起流式请求；Promise 在流结束/中止后 resolve（{ aborted }），失败则 reject。
   * 取消：调用 streamAbort(requestId)。
   */
  streamRequest(
    config: Record<string, unknown>,
    handlers: AiStreamHandlers
  ): Promise<{ aborted: boolean }>
  /** 取消进行中的流式请求 */
  streamAbort(requestId: string): void
}
