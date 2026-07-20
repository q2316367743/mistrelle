export type ChatMessageRole = 'user' | 'assistant' | 'system'
export type ChatMessageStatus = 'pending' | 'streaming' | 'complete' | 'stop' | 'error'
export type ChatStatus = 'idle' | ChatMessageStatus
export type ChatContentType =
  | 'text'
  | 'markdown'
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
  status?: ChatMessageStatus
  id?: string
  strategy?: 'merge' | 'append'
  ext?: Record<string, any>
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
  metadata?: Record<string, any>
}
export type AttachmentContent = ChatBaseContent<'attachment', AttachmentItem[]>
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
  payload?: Record<string, any>
}
export type ToolCallContent = ChatBaseContent<'toolcall', ToolCall>
export type ActivityData<TContent = Record<string, any>> = {
  activityType: string
  messageId?: string
  content: TContent
  /** 增量更新信息 */
  deltaInfo?: {
    fromIndex: number
    toIndex: number
  }
}
export type ActivityContent<TContent = Record<string, any>> = ChatBaseContent<
  'activity',
  ActivityData<TContent>
>
export interface ChatBaseMessage {
  id: string
  status?: ChatMessageStatus
  datetime?: string
  ext?: any
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
export type UserMessageContent = TextContent | AttachmentContent
export interface UserMessage extends ChatBaseMessage {
  role: 'user'
  // 使用的模型
  model: string
  // 提供商
  provide: string
  thinking?: 'enabled' | 'disabled'
  reasoning_effort?: 'high' | 'max'
  content: UserMessageContent[]
}
export type ChatComment = 'good' | 'bad' | ''
export interface AIMessage extends ChatBaseMessage {
  role: 'assistant'
  // 内容
  content?: AIMessageContent[]
  // 历史消息
  history?: AIMessageContent[][]
  /** 点赞点踩 */
  comment?: ChatComment
}
export interface SystemMessage extends ChatBaseMessage {
  role: 'system'
  content: TextContent[]
}
export type ChatMessage = UserMessage | AIMessage | SystemMessage
