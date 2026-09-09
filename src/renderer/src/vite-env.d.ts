/// <reference types="vite/client" />
import { AxiosInstance, AxiosRequestConfig } from 'axios'
import { AiStreamApi } from '@/types/aiStream'
import { RelayApi } from '@/types/relay'
import { TrafficLightApi } from '@common/types/trafficLight'
import { IntegrationApi } from '@common/types/integrations'
import { PermissionApi } from '@common/types/permissionRequest'
import { Esp32LcdApi } from '@common/types/esp32Lcd'
import { KeypadApi } from '@common/types/keypad'
import { QuotaApi } from '@common/types/quota'

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
        pathToFileHref(path: string): string
      }
      crypto: CryptoApi
      inject: InjectApi
      fs: FsApi
      path: PathApi
      zip: ZipApi
      font: FontApi
      aiStream: AiStreamApi
      safeStorage: SafeStorageApi
      webUtils: WebUtilsApi
      db: DbApi
      image: ImageApi
      auth: AuthApi
      updater: UpdaterApi
      relay: RelayApi
      serial: SerialApi
      /** 红绿灯配置桥：仅伙伴窗口独立 preload（out/preload/buddy.js）注入，主窗口运行时不存在 */
      trafficLight: TrafficLightApi
      /** 应用集成桥：外部软件接入配置检查/安装，仅伙伴窗口独立 preload 注入，主窗口运行时不存在 */
      integrations: IntegrationApi
      /** ESP32 LCD 配置桥：仅伙伴窗口独立 preload 注入，主窗口运行时不存在 */
      esp32Lcd: Esp32LcdApi
      /** 小键盘配置桥：仅伙伴窗口独立 preload 注入，主窗口运行时不存在 */
      keypad: KeypadApi
      /** 额度插件公共域桥：仅伙伴窗口独立 preload 注入，主窗口运行时不存在 */
      quota: QuotaApi
      /** 权限审批基座桥：仅伙伴窗口独立 preload 注入，主窗口运行时不存在 */
      permission: PermissionApi
      template: {
        /** 渲染 resources/templates/<name>.ejs 并返回完整 HTML 字符串（实现位于 main） */
        render(params: { name: string; data: Record<string, unknown> }): Promise<string>
      }
      shellExec: {
        cliRun(
          command: string,
          args?: string[],
          options?: { cwd?: string; timeout?: number }
        ): Promise<{
          stdout?: string
          stderr?: string
          exitCode?: number | null
          signal?: string
          error?: string
        }>
      }
      axios: AxiosInstance
    }
  }
}
