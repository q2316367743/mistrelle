import type { AiProvideFormat } from '@/entity'

// ==========================================
//  归一化类型（对齐 OpenAI Chat 兼容形状，三种格式的适配器在两端做转换）
// ==========================================

export type AiMessageRole = 'system' | 'user' | 'assistant' | 'tool'

export interface AiToolCallParam {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

// ==========================================
//  多模态内容块（仅 user 消息使用；对齐 OpenAI Chat 形状，
//  responses / anthropic 适配器在 buildRequest 时转换成各自协议形状）
// ==========================================

export interface AiTextBlock {
  type: 'text'
  text: string
}

/** 图像块：url 为 data URL（本地文件转 base64）或可公网访问的 http(s) 地址 */
export interface AiImageBlock {
  type: 'image_url'
  image_url: { url: string }
}

export type AiContentBlock = AiTextBlock | AiImageBlock

export interface AiMessageParam {
  role: AiMessageRole
  /** 纯文本消息为 string；带图像的用户消息为内容块数组 */
  content: string | AiContentBlock[] | null
  tool_calls?: AiToolCallParam[]
  tool_call_id?: string
  /** DeepSeek 思考回显（assistant 消息透传；anthropic / responses 用不到） */
  reasoning_content?: string
}

export interface AiTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

// 流式 chunk（消费形状对齐 openai ChatCompletionChunk，streamAgentStep 等下游无需感知格式）
export interface AiToolCallDelta {
  index: number
  id?: string
  function?: {
    name?: string
    arguments?: string
  }
}

export interface AiStreamChunk {
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  choices?: Array<{
    finish_reason?: string | null
    delta: {
      content?: string | null
      reasoning_content?: string
      tool_calls?: AiToolCallDelta[]
    }
    /** 兜底：个别服务端对 `stream: true` 仍返回非流式 JSON（无 delta，只有 message） */
    message?: {
      content?: string | null
    }
  }>
}

export interface AiUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface AiCompletionResult {
  content: string
  finishReason?: string | null
  usage?: AiUsage
}

// 统一请求参数（格式无关；format 决定走哪个适配器）
export interface AiRequestParams {
  baseURL: string
  apiKey?: string
  format: AiProvideFormat
  model: string
  messages: AiMessageParam[]
  tools?: AiTool[]
  /** 是否启用思考模式（chat: thinking.type；responses: reasoning.effort；anthropic: thinking 块） */
  thinking?: boolean
  /** 思考强度（chat: reasoning_effort；responses: reasoning.effort） */
  reasoningEffort?: string
  /** 生成上限（anthropic 必填，缺省适配器内部给默认值） */
  maxTokens?: number
  signal?: AbortSignal
  /** 附加请求头（如 onRequest 覆盖） */
  headers?: Record<string, string>
  /** 格式原生 body 覆盖（onRequest 覆盖，spread 进请求体，优先级最高） */
  bodyOverride?: Record<string, unknown>
}
