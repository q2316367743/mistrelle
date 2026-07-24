/// <reference types="vite/client" />
import { AxiosInstance, AxiosRequestConfig } from 'axios'

declare global {
  /** MCP 服务器返回的工具定义（对应 MCP 协议的 Tool schema） */
  interface McpToolDefinition {
    name: string
    description?: string
    inputSchema?: {
      type: 'object'
      properties?: Record<string, unknown>
      required?: string[]
    }
  }

  interface Window {
    preload: {
      iconv: {
        parseBuffer(buffer: ArrayBufferLike<number>, charset: string): string
        parseArrayBuffer(arrayBuffer: ArrayBuffer, charset: string): string
        convertCharset(content: string, source: string, target?: string): string
      }
      net: {
        /**
         * 从url下载一个文件到指定目录
         * @param config 下载参数
         * @param path 要保存的文件路径，包含文件名
         */
        downloadFileFromUrl(config: AxiosRequestConfig, path: string): Promise<void>
        /**
         * 将路径转换为href
         * @param path 路径
         */
        pathToHref(path: string): string
      }
      crypto: CryptoApi
      inject: InjectApi
      fs: FsApi
      path: PathApi
      zip: ZipApi
      shellExec: {
        cliRun(
          command: string,
          args?: string[],
          options?: { cwd?: string; timeout?: number }
        ): {
          stdout?: string
          stderr?: string
          exitCode?: number
          signal?: string
          error?: string
        }
        jsRun(
          script: string,
          args?: Record<string, unknown>
        ): {
          result?: unknown
          stdout?: string
          error?: string
        }
      }
      mcp: {
        /**
         * 连接一个 MCP 服务器并返回其全部工具定义。
         * @param name 服务器唯一标识（对应 AiTool.name）
         * @param config local 走 stdio 传输，remote 走 Streamable HTTP / SSE
         */
        connect(
          name: string,
          config:
            | { type: 'local'; command: string[]; env?: Record<string, string> }
            | { type: 'remote'; url: string; headers?: Record<string, string> }
        ): Promise<McpToolDefinition[]>
        /** 断开指定 MCP 服务器连接 */
        disconnect(name: string): Promise<void>
        /** 断开全部 MCP 连接 */
        disconnectAll(): Promise<void>
        /**
         * 调用指定 MCP 服务器上的工具
         * @returns 序列化后的工具输出文本
         */
        callTool(name: string, toolName: string, args: Record<string, unknown>): Promise<string>
        /** 重新拉取指定服务器的工具列表 */
        listTools(name: string): Promise<McpToolDefinition[]>
        /** 查询指定服务器是否已连接 */
        isConnected(name: string): boolean
      }
      axios: AxiosInstance
    }
  }
}
