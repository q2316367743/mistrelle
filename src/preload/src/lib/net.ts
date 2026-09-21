/**
 * net 桥（preload）：原 src-utools/src/net.js 的迁移拆分。
 * - downloadFileFromUrl：网络 + 落盘，直接在本进程（sandbox:false，Node 上下文）
 *   用 axios + node:fs 实现。onDownloadProgress 回调经 contextBridge 代理传入，
 *   与 axios 同进程调用即可，无需跨 IPC（结构化克隆无法序列化函数）。
 * - pathToHref：纯函数（路径 → 本地事件服务资源 URL），同步实现
 */
import { resolve } from 'node:path'
import { createWriteStream } from 'node:fs'
import type { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'
import axios from 'axios'
import { EVENT_SERVER_ORIGIN } from '@common/server/eventServer'

export const netApi = {
  /**
   * 从 url 下载一个文件
   * @param config axios 请求配置（可含 onDownloadProgress 进度回调）
   * @param path 保存的地址
   */
  downloadFileFromUrl: async (config: Record<string, unknown>, path: string): Promise<void> => {
    const response = await axios({
      ...config,
      adapter: axios.getAdapter('http'),
      responseType: 'stream'
    })
    const stream = response.data as Readable
    await new Promise<void>((resolve, reject) => {
      const file = createWriteStream(path)
      stream.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
      file.on('error', reject)
      stream.on('error', reject)
    })
  },

  /** 将绝对路径转换为本地事件服务的资源 URL（渲染层经 HTTP 加载本地资源；dev 下 file:// 会被 Chromium 拦截） */
  pathToHref: (path: string): string =>
    `${EVENT_SERVER_ORIGIN}/file/${encodeURIComponent(resolve(path))}?_t=${Date.now()}`,
  pathToFileHref: (path: string): string => pathToFileURL(resolve(path)).href
}
