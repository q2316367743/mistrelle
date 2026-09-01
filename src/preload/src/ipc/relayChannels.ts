/**
 * 服务端中转域通道常量与类型（preload 桥与 main handler 共用）。
 *
 * 背景（见 docs/auth/01-server-auth.md 与 docs/setting/ 下 AI 设置文档）：
 * - 「内置供应商」= 对接本地 mistrelle-server 的 OpenAI 兼容中转站（/v1/*）。
 * - 鉴权依赖登录凭证（长期 API Key），凭证只存在于主进程 AuthService，渲染层不可达；
 *   因此中转请求统一走本域 IPC：main 注入 `Authorization: Bearer <apiKey>` 后转发。
 * - listModels：GET {server}/v1/models（模型列表，OpenAI list 形状）；
 *   chatStream：POST {server}/v1/chat/completions（OpenAI 兼容流式 SSE，按积分记账）。
 * - 流式回调不能作为 invoke 参数：Electron structured clone 无法克隆函数
 *   （会报 An object could not be cloned）。preload 本地保留 handlers，
 *   main 经 start/chunk/end 事件回推字节；invoke 只传可克隆的 params + requestId。
 * - 这与 aiStream 不同：aiStream 的 HTTP 跑在 preload 同进程，handlers 可直接调用；
 *   relay 必须在 main 注入凭证，HTTP 不能下沉到 preload。
 */
export const RelayChannels = {
  /** 拉取内置模型列表（GET {server}/v1/models，Bearer apiKey） */
  listModels: 'relay:listModels',
  /** 发起中转对话流（POST {server}/v1/chat/completions）；参数仅 params + requestId */
  chatStream: 'relay:chatStream',
  /** 响应头就绪（含 requestId / status / headers） */
  chatStreamStart: 'relay:chatStreamStart',
  /** 数据块（requestId + ArrayBuffer） */
  chatStreamChunk: 'relay:chatStreamChunk',
  /** 流结束（成功 aborted / 失败 error） */
  chatStreamEnd: 'relay:chatStreamEnd',
  /** 取消进行中的中转对话流 */
  abortStream: 'relay:abortStream'
} as const

/** 内置模型（GET /v1/models 的 OpenAI list 形状项） */
export interface RelayModel {
  id: string
}

/**
 * 中转对话参数（POST /v1/chat/completions）。
 * body 为 OpenAI chat 形状请求体（渲染层 chatAdapter.buildRequest 产出，
 * relay 层 additionalProperties 透传）；sessionId 可选，缺省服务端回退 user / 用户 id。
 */
export interface RelayChatParams {
  body: Record<string, unknown>
  /** 会话 id（透传 session_id，作 newapi 渠道亲和键；缺省服务端回退 user / 用户 id） */
  sessionId?: string
  /** 单次 completions 记录 id（透传 request_id，只作对账，不参与选渠） */
  requestId?: string
}

/** 中转流式回调（只做字节转发，协议解析在渲染层 modules/ai；仅 preload 本地调用） */
export interface RelayStreamHandlers {
  /** 响应头就绪回调（首个数据块之前，回传 requestId 供取消） */
  onStart?: (info: { requestId: string; status: number; headers: Record<string, string> }) => void
  /** 数据块回调：独立 ArrayBuffer（与 aiStream 约定一致） */
  onChunk?: (chunk: ArrayBuffer) => void
}

/** main → preload：流结束载荷（以事件为准，避免 invoke 回包赶超最后几个 chunk） */
export interface RelayStreamEndPayload {
  requestId: string
  aborted?: boolean
  error?: string
}
