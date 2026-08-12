/**
 * net IPC handler（main 进程）：downloadFileFromUrl 迁入 main（网络 + 落盘属特权操作）。
 * pathToHref 为纯函数，保留在 preload 侧实现。
 */
import { ipcMain } from 'electron'
import { createWriteStream } from 'node:fs'
import axios from 'axios'
import { NetChannels } from '~/channels'

export function registerNetIpc(): void {
  ipcMain.handle(
    NetChannels.downloadFileFromUrl,
    async (_event, config: Record<string, unknown>, path: string): Promise<void> => {
      const response = await axios({
        ...config,
        adapter: 'http',
        responseType: 'stream'
      })
      await new Promise<void>((resolve, reject) => {
        const file = createWriteStream(path)
        response.data.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve()
        })
        file.on('error', reject)
        response.data.on('error', reject)
      })
    }
  )
}
