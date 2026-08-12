/**
 * net 桥（preload）：原 src-utools/src/net.js 的迁移拆分。
 * - downloadFileFromUrl：网络 + 落盘，迁入 main（netIpc.ts）
 * - pathToHref：纯函数（路径 → mistrelle:// URL），留在 preload 同步实现
 */
import { ipcRenderer } from 'electron'
import { resolve } from 'node:path'
import { NetChannels } from './channels'

export const netApi = {
  /**
   * 从 url 下载一个文件
   * @param config axios 请求配置
   * @param path 保存的地址
   */
  downloadFileFromUrl: (config: Record<string, unknown>, path: string): Promise<void> => {
    return ipcRenderer.invoke(NetChannels.downloadFileFromUrl, config, path)
  },

  /** 将绝对路径转换为 mistrelle:// URL（渲染层经自定义协议加载本地资源；dev 下 file:// 会被 Chromium 拦截） */
  pathToHref: (path: string): string => `mistrelle://local/${encodeURIComponent(resolve(path))}`
}
