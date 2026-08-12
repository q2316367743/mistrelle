
export interface ToolProperty {
  type: string
  description: string
  items?: ToolProperty
  properties?: Record<string, ToolProperty>
  required?: string[]
  enum?: unknown[]
  const?: unknown
  anyOf?: ToolProperty[]
  oneOf?: ToolProperty[]
  additionalProperties?: boolean
}

/**
 * 工具基础风险等级（静态声明，由工具定义侧指定）
 * - safe: 只读 / 无副作用，永不弹窗
 * - sensitive: 有副作用但可控，策略可降级为自动放行
 * - dangerous: 破坏性操作，策略只能升级不能降级（沙盒内可放行，沙盒外强制审批）
 */
export type ToolRiskLevel = 'safe' | 'sensitive' | 'dangerous'

/** 策略解析器最终裁决 */
export type ToolPolicyVerdict = 'allow' | 'ask' | 'deny'

export interface ToolFunction {
  name: string
  label: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, ToolProperty>
    required?: Array<string>
    additionalProperties?: boolean
  }
  handler: (...params: unknown[]) => Promise<unknown>
  /** 基础风险等级，未指定时默认 sensitive */
  risk?: ToolRiskLevel
  /** 内部工具：仅注册供声明了它的 agent 调用，不对外展示（toolOptions）、不可分配给其他 agent（list_tools） */
  internal?: boolean
  /** 序列化历史消息时从 args 中剥离的字段，节省 token（如写入类 tool 的 content） */
  stripFields?: string[]
}
