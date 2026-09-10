/**
 * 服务端中转桥类型（window.preload.relay）。
 * 与 preload/src/modules/relay/relayChannels.ts 对应：只做字节转发，协议解析在渲染层。
 */

/** 内置模型（GET /v1/models 的 OpenAI list 形状项） */
export interface RelayModel {
  id: string
}

/** 中转对话参数（POST /v1/chat/completions；sessionId 可选，缺省服务端回退 user / 用户 id） */
export interface RelayChatParams {
  body: Record<string, unknown>
  sessionId?: string
  requestId?: string
}

/** 去 AI 味改写参数（POST /api/rewrite） */
export interface RelayRewriteParams {
  content: string
  depth?: number
}

export interface RelayStreamInfo {
  requestId: string
  status: number
  headers: Record<string, string>
}

export interface RelayStreamHandlers {
  /** 响应头就绪回调（首个数据块之前，回传 requestId 供取消） */
  onStart?: (info: RelayStreamInfo) => void
  /** 数据块回调：独立 ArrayBuffer */
  onChunk?: (chunk: ArrayBuffer) => void
}

export interface RelayApi {
  /** 拉取内置模型列表（GET {server}/v1/models；未登录抛错） */
  listModels(): Promise<RelayModel[]>
  /**
   * 发起中转对话流（POST {server}/v1/chat/completions）。
   * Promise 在流结束/中止后 resolve（{ aborted }），失败 reject。
   * 取消：streamAbort(requestId)（requestId 经 onStart 回传）。
   */
  chatStream(params: RelayChatParams, handlers: RelayStreamHandlers): Promise<{ aborted: boolean }>
  /**
   * 去 AI 味流式改写（POST {server}/api/rewrite）。
   * 取消同样走 streamAbort(requestId)。
   */
  rewriteStream(
    params: RelayRewriteParams,
    handlers: RelayStreamHandlers
  ): Promise<{ aborted: boolean }>
  /** 取消进行中的中转对话流 / 去 AI 味流 */
  streamAbort(requestId: string): void
}
