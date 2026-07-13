
export interface ToolFunction {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required?: Array<string>
    additionalProperties?: boolean
  }
  handler: (...params: unknown[]) => Promise<unknown>
}
