import type { ToolFunction, ToolPolicyVerdict } from '@/domain'

/** 策略解析所需的运行时上下文 */
export interface ToolPolicyContext {
  sandboxDir: string
  workspace: string
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
