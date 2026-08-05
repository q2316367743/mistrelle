import type { ChatType } from '@/modules/chat/chatType'

/**
 * 子 Agent 能力类型：
 * - research：调研型（默认，只读调研 / 分析，返回结构化摘要）
 * - design：设计型（画布创作配图 / 设计稿，产物落盘到可信区）
 */
export type SubAgentType = 'research' | 'design'

/**
 * 子 Agent 能力矩阵（单一数据源）：各聊天类型允许派发的子 Agent 类型。
 * - 日常办公 / 设计创意：仅调研型（设计对话的画布在主对话，子 Agent 不重复设计能力）
 * - 写作：调研型 + 设计型（文章配图走 design 型子 Agent）
 * 新增聊天类型或能力类型只需改这里。
 */
export const SUB_AGENT_ALLOW: Record<ChatType, ReadonlyArray<SubAgentType>> = {
  office: ['research'],
  design: ['research'],
  writing: ['research', 'design']
}

/** 子 Agent 运行选项（由 spawn_agent 工具解析后透传） */
export interface SubAgentOptions {
  /** 子 Agent ID（由调用方预生成并先行标记到主 Agent 消息） */
  subId: string
  /** 主 Agent 的聊天 ID（用于构建子 Agent 文件路径） */
  chatId: string
  /** 任务描述 */
  task: string
  /** 沙盒目录（继承自主 Agent） */
  sandboxDir: string
  /** 工作空间（继承自主 Agent） */
  workspace: string
  /** 模型 ID */
  model: string
  /** 模型提供商 */
  provide: string
  /** 推理强度 */
  reasoningEffort?: 'high' | 'max'
  /** 子 Agent 能力类型（缺省 research） */
  subAgentType?: SubAgentType
  /** 主 Agent 的 AbortSignal：主 Agent 终止时级联终止子 Agent */
  parentSignal?: AbortSignal
}

/** 子 Agent 执行结果 */
export interface SubAgentResult {
  subId: string
  summary: string
  status: 'completed' | 'error'
}

/** 类型解析结果：合法返回 SubAgentType，非法返回错误消息（string） */
export type ResolveSubAgentTypeResult = SubAgentType | string

/**
 * 解析 spawn_agent 的 type 参数并校验当前聊天类型是否允许。
 * 缺省 / 空值按 research 处理（向后兼容旧行为）。
 * 不合法返回错误消息（string），由调用方直接回填工具结果，避免模型尝试被禁用的能力。
 */
export const resolveSubAgentType = (
  raw: unknown,
  chatType: ChatType
): ResolveSubAgentTypeResult => {
  const requested = raw === undefined || raw === null || raw === '' ? 'research' : raw
  const allowed = SUB_AGENT_ALLOW[chatType]
  if (typeof requested === 'string' && (allowed as readonly string[]).includes(requested)) {
    return requested as SubAgentType
  }
  return `当前聊天类型不支持「${String(requested)}」型子 Agent，可用：${allowed.join(' / ')}`
}
