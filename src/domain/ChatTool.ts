
export interface ToolProperty {
  type: string
  description: string
  items?: ToolProperty
  properties?: Record<string, ToolProperty>
  required?: string[]
}

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
  requireConfirm?: boolean
  /** 序列化历史消息时从 args 中剥离的字段，节省 token（如写入类 tool 的 content） */
  stripFields?: string[]
}
