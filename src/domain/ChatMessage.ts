import { AiChatMode } from '@/entity'

export type ChatMessageRole = 'user' | 'assistant' | 'system'
export type ChatMessageStatus = 'pending' | 'streaming' | 'complete' | 'stop' | 'error'
export type ChatStatus = 'idle' | ChatMessageStatus
export type ChatContentType =
  | 'text'
  | 'markdown'
  | 'skill'
  | 'tool'
  | 'search'
  | 'attachment'
  | 'thinking'
  | 'image'
  | 'audio'
  | 'video'
  | 'suggestion'
  | 'reasoning'
  | 'toolcall'
  | 'activity'
export type AttachmentType = 'image' | 'video' | 'audio' | 'pdf' | 'doc' | 'ppt' | 'txt'
export interface ChatBaseContent<T extends string, TData> {
  type: T
  data: TData
  /** 同一次模型响应产生的内容共享该标识，用于还原 API 工具调用轮次。 */
  stepId?: string
  status?: ChatMessageStatus
  id?: string
  strategy?: 'merge' | 'append'
  ext?: Record<string, unknown>
  // 创建时间
  time: number
}
export type TextContent = ChatBaseContent<'text', string>
export type MarkdownContent = ChatBaseContent<'markdown', string>
export type ImageContent = ChatBaseContent<
  'image',
  {
    name?: string
    url?: string
    width?: number
    height?: number
  }
>
export type ReferenceItem = {
  title: string
  icon?: string
  type?: string
  url?: string
  content?: string
  site?: string
  date?: string
}
export type SearchContent = ChatBaseContent<
  'search',
  {
    title?: string
    references?: ReferenceItem[]
  }
>
export type SuggestionItem = {
  title: string
  prompt?: string
}
export type SuggestionContent = ChatBaseContent<'suggestion', SuggestionItem[]>
export type ReasoningContent = ChatBaseContent<'reasoning', AIMessageContent[]>
export type AttachmentItem = {
  fileType: AttachmentType
  size?: number
  name?: string
  url?: string
  isReference?: boolean
  width?: number
  height?: number
  extension?: string
  metadata?: Record<string, unknown>
}
export type AttachmentContent = ChatBaseContent<'attachment', AttachmentItem[]>
// 用户在输入框中通过 "/" 引用的本地 skill（仅存引用，发送时按需读取全文）
export type SkillItem = {
  path: string
  name: string
  agentName?: string
  dirName?: string
}
export type SkillContent = ChatBaseContent<'skill', SkillItem>
export type ToolItem = {
  name: string
  label: string
}
export type ToolContent = ChatBaseContent<'tool', ToolItem>
/** 用户在画布侧边栏双击节点引用：version 即 canvas-{version}.canvas 版本号，供 AI canvas_open 打开定位节点 */
export type CanvasItem = {
  version: number
  nodeId: string
  /** 节点图层名（无 name 时回退为 nodeId），仅用于展示 */
  label?: string
}
export type CanvasContent = ChatBaseContent<'canvas', CanvasItem>
export type ThinkingContent = ChatBaseContent<
  'thinking',
  {
    text?: string
    title?: string
  }
>
export type ToolCall = {
  // 工具调用ID
  toolCallId: string
  // 工具调用名称
  toolCallName: string
  // 工具调用参数
  args?: string
  // 工具调用结果
  result?: string
  // 负载
  payload?: Record<string, unknown>
}
export type ToolCallContent = ChatBaseContent<'toolcall', ToolCall>
export type ActivityData<TContent = Record<string, unknown>> = {
  activityType: string
  messageId?: string
  content: TContent
  /** 增量更新信息 */
  deltaInfo?: {
    fromIndex: number
    toIndex: number
  }
}
export type ActivityContent<TContent = Record<string, unknown>> = ChatBaseContent<
  'activity',
  ActivityData<TContent>
>
export interface ChatBaseMessage {
  id: string
  status?: ChatMessageStatus
  datetime?: string
  ext?: Record<string, unknown>
}
type AIContentTypeMap = {
  text: TextContent
  markdown: MarkdownContent
  thinking: ThinkingContent
  image: ImageContent
  search: SearchContent
  suggestion: SuggestionContent
  reasoning: ReasoningContent
  toolcall: ToolCallContent
  activity: ActivityContent
}
export type AIContentType = keyof AIContentTypeMap
export type AIMessageContent = AIContentTypeMap[AIContentType]
export type UserMessageContent =
  | TextContent
  | AttachmentContent
  | SkillContent
  | ToolContent
  | CanvasContent
/** 思考强度（DeepSeek 思考模式）：low / high / max，默认 high */
export type ThinkingEffort = 'low' | 'high' | 'max'
export interface UserMessage extends ChatBaseMessage {
  role: 'user'
  // 使用的模型
  model: string
  // 提供商
  provide: string
  // 是否启用思考模式
  thinking?: boolean
  // 思考强度
  reasoning_effort?: ThinkingEffort
  content: UserMessageContent[]
}
/** 单次模型请求的 token 用量（来自 API usage 字段） */
export interface ChatUsage {
  // 输入 token（一次请求发送给模型的全部内容）
  promptTokens: number
  // 输出 token
  completionTokens: number
  // prompt + completion
  totalTokens: number
}

/** 当前上下文按构成来源拆分后的 token 估算（本地估算后归一化到 promptTokens） */
export interface TokenBreakdown {
  // 系统提示词
  system: number
  // 工具及子智能体
  tools: number
  // 对话消息
  conversation: number
  // 技能
  skills: number
}

export type TodoStatus = 'pending' | 'in_progress' | 'completed'
export interface TodoItem {
  id: string
  content: string
  status: TodoStatus
  createdAt: number
  updatedAt: number
}
export type ChatComment = 'good' | 'bad' | ''
export interface AIMessage extends ChatBaseMessage {
  role: 'assistant'
  // 使用的模型
  model: string
  // 提供商
  provide: string
  // agent ID
  agentId?: string
  // 聊天模式
  mode: AiChatMode
  // 是否启用思考模式
  thinking?: boolean
  // 思考强度
  reasoning_effort?: ThinkingEffort
  // 内容
  content?: AIMessageContent[]
  // 历史消息
  history?: AIMessageContent[][]
  /** 点赞点踩 */
  comment?: ChatComment
  /** 完成时间戳（ms） */
  finishedAt?: number
  /** 本条回复过程中 spawn 的子 Agent ID 列表（用于 UI 展示子 Agent 切换卡片） */
  subAgentIds?: string[]
  /** 本条回复消耗的 token 用量（来自 API usage；多步 agent loop 累计） */
  usage?: ChatUsage
  /** 当前上下文按来源拆分后的 token 估算（归一化到 usage.promptTokens） */
  tokenBreakdown?: TokenBreakdown
}
export interface SystemMessage extends ChatBaseMessage {
  role: 'system'
  content: TextContent[]
}
export type ChatMessage = UserMessage | AIMessage | SystemMessage
