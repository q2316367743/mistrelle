import type { ToolFunction, ToolPolicyVerdict } from '@/domain'
import type { AiChatMode } from '@/entity'

/** 策略解析所需的运行时上下文 */
export interface ToolPolicyContext {
  sandboxDir: string
  workspace: string
  /** 当前聊天模式，用于按模式约束工具执行（0 默认 / 1 计划：无写入·shell 需审批 / 2 完全访问） */
  mode?: AiChatMode
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
