interface AiToolBase {
  name: string
  type: 'local' | 'remote'
  enabled: boolean
}

interface AiToolLocal extends AiToolBase {
  type: 'local'
  command: Array<string>
  /** 启动 MCP 进程时注入的环境变量，如 API Key 等 */
  env?: Record<string, string>
}

interface AiToolRemote extends AiToolBase {
  type: 'remote'
  url: string
  /** 请求 MCP 服务时附带的 HTTP 头，如 Authorization 等 */
  headers?: Record<string, string>
}

export type AiTool = AiToolLocal | AiToolRemote
