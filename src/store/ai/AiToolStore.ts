import { defineStore } from 'pinia'
import { useUtoolsDbAsync } from '@/hooks'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { AiTool } from '@/entity/ai'
import type { ToolFunction, ToolProperty } from '@/domain'

export type McpStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface McpConnectionState {
  status: McpStatus
  error?: string
  tools: ToolFunction[]
}

export const useAiToolStore = defineStore('ai:tool', () => {
  /** 持久化的 MCP 服务器配置列表 */
  const state = useUtoolsDbAsync<Array<AiTool>>(LocalNameEnum.LIST_AI_TOOL, [])

  /** 运行时连接状态，key 为 AiTool.name，不持久化 */
  const connections = ref<Record<string, McpConnectionState>>({})

  /**
   * 将 MCP 工具定义转为 ToolFunction。
   * handler 闭包捕获服务器名与原始工具名，调用时经 preload 桥接到 MCP 进程。
   */
  const toToolFunction = (serverName: string, mcpTool: McpToolDefinition): ToolFunction => {
    const schema = mcpTool.inputSchema
    return {
      name: `mcp__${serverName}__${mcpTool.name}`,
      label: mcpTool.name,
      description: mcpTool.description ?? '',
      parameters: {
        type: 'object',
        // MCP inputSchema 遵循 JSON Schema，与 ToolProperty 结构兼容
        properties: (schema?.properties ?? {}) as Record<string, ToolProperty>,
        required: schema?.required ?? []
      },
      // MCP 为外部工具，默认需审批
      risk: 'sensitive',
      handler: async (args: unknown) => {
        return window.preload.mcp.callTool(
          serverName,
          mcpTool.name,
          (args ?? {}) as Record<string, unknown>
        )
      }
    }
  }

  /** 连接指定 MCP 服务器，成功后缓存其工具列表 */
  const connect = async (name: string) => {
    const tool = state.value.find((t) => t.name === name)
    if (!tool) return

    connections.value[name] = { status: 'connecting', tools: [] }
    try {
      const config =
        tool.type === 'local'
          ? { type: 'local' as const, command: tool.command, env: tool.env }
          : { type: 'remote' as const, url: tool.url, headers: tool.headers }
      const mcpTools = await window.preload.mcp.connect(name, config)
      connections.value[name] = {
        status: 'connected',
        tools: mcpTools.map((t) => toToolFunction(name, t))
      }
    } catch (e) {
      connections.value[name] = {
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
        tools: []
      }
    }
  }

  /** 断开指定 MCP 服务器 */
  const disconnect = async (name: string) => {
    await window.preload.mcp.disconnect(name)
    const next = { ...connections.value }
    delete next[name]
    connections.value = next
  }

  /** 断开全部 MCP 连接 */
  const disconnectAll = async () => {
    await window.preload.mcp.disconnectAll()
    connections.value = {}
  }

  /** 仅重新拉取已连接服务器的工具列表（不重连） */
  const refreshTools = async (name: string) => {
    if (!window.preload.mcp.isConnected(name)) return
    try {
      const mcpTools = await window.preload.mcp.listTools(name)
      const conn = connections.value[name]
      if (conn) {
        conn.tools = mcpTools.map((t) => toToolFunction(name, t))
      }
    } catch {
      // 拉取失败保持现有工具列表
    }
  }

  /** 自动连接所有已启用的 MCP 服务器，适合在应用初始化时调用 */
  const initConnections = async () => {
    const enabled = state.value.filter((t) => t.enabled)
    await Promise.allSettled(enabled.map((t) => connect(t.name)))
  }

  /** 获取所有已启用且已连接的 MCP 工具，供 getFunctions 注入 */
  const getMcpTools = (): ToolFunction[] => {
    return state.value
      .filter((t) => t.enabled && connections.value[t.name]?.status === 'connected')
      .flatMap((t) => connections.value[t.name]?.tools ?? [])
  }

  // ---- CRUD ----

  const add = (tool: AiTool) => {
    state.value = [...state.value, tool]
  }

  const remove = async (name: string) => {
    await disconnect(name)
    state.value = state.value.filter((t) => t.name !== name)
  }

  const update = (tool: AiTool) => {
    state.value = state.value.map((t) => (t.name === tool.name ? tool : t))
  }

  /** 切换启用状态，启用时自动连接，禁用时自动断开 */
  const toggle = async (name: string, enabled: boolean) => {
    state.value = state.value.map((t) => (t.name === name ? { ...t, enabled } : t))
    if (enabled) {
      await connect(name)
    } else {
      await disconnect(name)
    }
  }

  return {
    state,
    connections,
    connect,
    disconnect,
    disconnectAll,
    refreshTools,
    initConnections,
    getMcpTools,
    add,
    remove,
    update,
    toggle
  }
})
