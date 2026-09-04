import type { ToolFunction, ToolPolicyVerdict } from '@/domain'
import type { AiChatMode } from '@/entity'
import type { ChatType } from '@/windows/main/modules/chat/chatType'

/** 策略解析所需的运行时上下文 */
export interface ToolPolicyContext {
  /** 当前聊天 ID（用于子 Agent 文件路径构建） */
  chatId?: string
  sandboxDir: string
  workspace: string
  /** 聊天级目录白名单：用户在确认卡片勾选「此目录以后都允许」的目录（仅本聊天生效） */
  allowedDirs?: string[]
  /** 用户批准工具时勾选「此目录以后都允许」的回写回调（子 Agent 不提供，保持只读约束） */
  onAllowDir?: (dir: string) => void
  /** skill agent 根目录集合（AgentChat 注入），其内脚本执行免审批 */
  skillRootDirs?: string[]
  /** 当前聊天模式，用于按模式约束工具执行（0 默认 / 1 计划：无写入·shell 需审批 / 2 完全访问） */
  mode?: AiChatMode
  /** 隐私聊天标记（AgentChat 注入，spawn_agent 透传给子 Agent 继承） */
  privacy?: boolean
  /** 是否为子 Agent（只读 · 无交互桥）：只读 shell 命令自动放行，需审批的操作会被禁用交互桥自动拒绝 */
  isSubAgent?: boolean
  /** 当前聊天类型（用于 spawn_agent 按能力矩阵校验子 Agent 类型） */
  chatType?: ChatType
  /** 当前请求的 AbortSignal（主 Agent 终止时级联到子 Agent） */
  abortSignal?: AbortSignal
}

/** 工具专属安全策略 */
export interface ToolPolicy {
  /** 匹配的工具名 */
  name: string
  /**
   * 返回裁决结果；返回 null 表示本轮不处理，交由默认策略兜底
   */
  resolve(
    tool: ToolFunction,
    args: Record<string, unknown>,
    ctx: ToolPolicyContext
  ): ToolPolicyVerdict | null
}
