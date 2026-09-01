/**
 * 服务端中转域通道常量与类型（preload 桥与 main handler 共用）。
 *
 * 背景（见 docs/auth/01-server-auth.md 与 docs/setting/ 下 AI 设置文档）：
 * - 「内置供应商」= 对接本地 mistrelle-server 的 OpenAI 兼容中转站（/v1/*）。
 * - 鉴权依赖登录凭证（长期 API Key），凭证只存在于主进程 AuthService，渲染层不可达；
 *   因此中转请求统一走本域 IPC：main 注入 `Authorization: Bearer <apiKey>` 后转发。
 * - listModels：GET {server}/v1/models（模型列表，OpenAI list 形状）；
 *   chatStream：POST {server}/v1/chat/completions（OpenAI 兼容流式 SSE，按积分记账），
 *   与 aiStream 桥同款约定：invoke 内完整跑完流，onStart/onChunk 经 contextBridge
 *   代理回调，Promise 在流结束/中止后 resolve，取消走 relay:abortStream。
 */
export const RelayChannels = {
  /** 拉取内置模型列表（GET {server}/v1/models，Bearer apiKey） */
  listModels: 'relay:listModels',
  /** 发起中转对话流（POST {server}/v1/chat/completions）；onStart 回传 requestId */
  chatStream: 'relay:chatStream',
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
  /** 会话 id（透传 session_id，用于服务端用量统计） */
  sessionId?: string
}

/** 中转流式回调（与 aiStream 桥同款：只做字节转发，协议解析在渲染层 modules/ai） */
export interface RelayStreamHandlers {
  /** 响应头就绪回调（首个数据块之前，回传 requestId 供取消） */
  onStart?: (info: { requestId: string; status: number; headers: Record<string, string> }) => void
  /** 数据块回调：独立 ArrayBuffer（与 aiStream 约定一致） */
  onChunk?: (chunk: ArrayBuffer) => void
}
