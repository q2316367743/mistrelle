const { spawnSync } = require('child_process')
const { Client } = require('@modelcontextprotocol/sdk/client')
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js')
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js')
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js')

// 与 shellExec 相同的 PATH 解析逻辑，确保 stdio 类 MCP 服务能找到 npx / node / python 等可执行文件
let USER_PATH = process.env.PATH || ''
if (process.platform !== 'win32') {
  const shell = process.env.SHELL || '/bin/zsh'
  try {
    const r = spawnSync(shell, ['-l', '-c', 'echo $PATH'], { encoding: 'utf-8', timeout: 5000 })
    if (r.stdout?.trim()) USER_PATH = r.stdout.trim()
  } catch {}
}

/** @type {Map<string, { client: InstanceType<typeof Client>, transport: unknown }>} */
const connections = new Map()

/**
 * 将 MCP callTool 返回的 content 数组序列化为纯文本，
 * 供渲染进程侧的 serializeResult 直接使用。
 */
const serializeContent = (content) => {
  if (!Array.isArray(content)) return ''
  return content
    .map((c) => {
      if (c.type === 'text') return c.text
      // image / audio / resource 等非文本类型退化为 JSON 描述
      return JSON.stringify(c)
    })
    .join('\n')
}

/**
 * 连接一个 MCP 服务器并返回其全部工具定义。
 * @param {string} name 服务器唯一标识（对应 AiTool.name）
 * @param {{ type: 'local', command: string[], env?: Record<string,string> }
 *       | { type: 'remote', url: string, headers?: Record<string,string> }} config
 * @returns {Promise<Array<{ name: string, description?: string, inputSchema?: object }>>}
 */
async function connect(name, config) {
  // 先断开已有连接，避免重复
  if (connections.has(name)) {
    await disconnect(name)
  }

  let client
  let transport

  if (config.type === 'local') {
    const [command, ...args] = config.command
    if (!command) throw new Error('command 不能为空')
    transport = new StdioClientTransport({
      command,
      args,
      env: { ...process.env, PATH: USER_PATH, ...(config.env || {}) },
    })
    client = new Client({ name: 'mistrelle', version: '1.0.0' })
    await client.connect(transport)
  } else {
    const parsedUrl = new URL(config.url)
    const options = config.headers ? { requestInit: { headers: config.headers } } : undefined
    // 优先尝试 Streamable HTTP，失败后回退 SSE
    try {
      transport = new StreamableHTTPClientTransport(parsedUrl, options)
      client = new Client({ name: 'mistrelle', version: '1.0.0' })
      await client.connect(transport)
    } catch {
      transport = new SSEClientTransport(parsedUrl, options)
      client = new Client({ name: 'mistrelle', version: '1.0.0' })
      await client.connect(transport)
    }
  }

  connections.set(name, { client, transport })

  // 分页拉取全部工具
  const tools = []
  let cursor
  do {
    const result = await client.listTools(cursor ? { cursor } : undefined)
    tools.push(...result.tools)
    cursor = result.nextCursor
  } while (cursor)

  return tools
}

/**
 * 断开指定 MCP 服务器连接。
 * @param {string} name
 */
async function disconnect(name) {
  const conn = connections.get(name)
  if (!conn) return
  try {
    await conn.client.close()
  } catch {
    // 连接可能已异常断开，忽略 close 错误
  }
  connections.delete(name)
}

/** 断开全部 MCP 连接，应用退出时调用。 */
async function disconnectAll() {
  const names = [...connections.keys()]
  await Promise.allSettled(names.map((n) => disconnect(n)))
}

/**
 * 调用指定 MCP 服务器上的工具。
 * @param {string} name 服务器标识
 * @param {string} toolName 工具名
 * @param {Record<string, unknown>} args 工具参数
 * @returns {Promise<string>} 序列化后的工具输出
 */
async function callTool(name, toolName, args) {
  const conn = connections.get(name)
  if (!conn) throw new Error(`MCP "${name}" 未连接`)
  const result = await conn.client.callTool({ name: toolName, arguments: args })
  if (result.isError) {
    throw new Error(serializeContent(result.content) || 'MCP 工具执行失败')
  }
  return serializeContent(result.content)
}

/**
 * 重新拉取指定服务器的工具列表（用于工具变更后刷新）。
 * @param {string} name
 * @returns {Promise<Array<{ name: string, description?: string, inputSchema?: object }>>}
 */
async function listTools(name) {
  const conn = connections.get(name)
  if (!conn) throw new Error(`MCP "${name}" 未连接`)
  const tools = []
  let cursor
  do {
    const result = await conn.client.listTools(cursor ? { cursor } : undefined)
    tools.push(...result.tools)
    cursor = result.nextCursor
  } while (cursor)
  return tools
}

/**
 * 查询指定服务器是否已连接。
 * @param {string} name
 * @returns {boolean}
 */
function isConnected(name) {
  return connections.has(name)
}

module.exports = { connect, disconnect, disconnectAll, callTool, listTools, isConnected }
