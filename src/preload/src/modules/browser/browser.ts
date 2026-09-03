/**
 * browser 桥（preload）：browser_fetch / browser_actions 工具的统一入口（原 inject.ts 的 runBrowser 段）。
 * 载荷（fetch/actions 判别联合）直传 main，由 BrowserToolRunner 在主进程内创建隐藏窗口执行。
 */
import { ipcRenderer } from 'electron'
import {
  BrowserToolChannels,
  type BrowserToolPayload,
  type BrowserToolResult
} from './browserChannels'

/**
 * error 时 reject，resolve 最后一个数据项（fetch 为提取的内容，actions 为最后一个 evaluate 类结果）。
 */
export const runBrowser = async (payload: BrowserToolPayload): Promise<unknown> => {
  const result = (await ipcRenderer.invoke(BrowserToolChannels.run, payload)) as BrowserToolResult
  if (result?.error) {
    throw new Error(result.message || 'browserTool run failed')
  }
  const data = result?.data
  return Array.isArray(data) ? data[data.length - 1] : undefined
}
