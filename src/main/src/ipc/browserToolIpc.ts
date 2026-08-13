/**
 * browserTool IPC handler（main 进程）：browser_fetch / browser_actions 工具的统一入口。
 * 载荷为判别联合（fetch / actions），由 BrowserToolRunner 在主进程内直接执行。
 */
import { ipcMain } from 'electron'
import { BrowserToolChannels, type BrowserToolPayload, type BrowserToolResult } from '~/channels'
import { BrowserToolRunner } from '$/browserTool/runner'

export function registerBrowserToolIpc(): void {
  ipcMain.handle(
    BrowserToolChannels.run,
    (_event, payload: BrowserToolPayload): Promise<BrowserToolResult> => {
      // 每次调用创建独立执行器实例（各自管理自己的 BrowserWindow）
      return new BrowserToolRunner().run(payload)
    }
  )
}
