/**
 * net 桥（preload）：原 src-utools/src/net.js 的迁移拆分。
 * - downloadFileFromUrl：网络 + 落盘，迁入 main（netIpc.ts）
 * - pathToHref：纯函数（node:url），留在 preload 同步实现
 */
import { ipcRenderer } from 'electron'
import { pathToFileURL } from 'node:url'
import { NetChannels } from './channels'

export const netApi = {
  /**
   * 从 url 下载一个文件
   * @param config axios 请求配置
   * @param path 保存的地址
   */
  downloadFileFromUrl: (config: Record<string, unknown>, path: string): Promise<void> =>
    ipcRenderer.invoke(NetChannels.downloadFileFromUrl, config, path),

  /** 将路径转换为 href */
  pathToHref: (path: string): string => pathToFileURL(path).href
}
