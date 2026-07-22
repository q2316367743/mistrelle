/// <reference types="vite/client" />
import { AxiosInstance, AxiosRequestConfig } from 'axios'

declare global {
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
          error?: string
        }
      }
      axios: AxiosInstance
    }
  }
}
