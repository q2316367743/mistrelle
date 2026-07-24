interface AiToolBase {
  name: string
  type: 'local' | 'remote'
  enabled: boolean
}

interface AiToolLocal extends AiToolBase {
  type: 'local'
  command: Array<string>
}

interface AiToolRemote extends AiToolBase {
  type: 'remote'
  url: string
}

export type AiTool = AiToolLocal | AiToolRemote
