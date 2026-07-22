
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
}
