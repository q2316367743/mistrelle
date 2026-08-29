/**
 * 工作条窗口独立 preload 入口（electron.vite.config.ts preload 多入口产出 toolbar.js）。
 * 只暴露条目搜索最小 API 面，不复用主应用 preload 的全量模块；实现均在主进程 toolbarIpc。
 * 全局名用 workbar：window.toolbar 与 DOM 遗留属性 BarProp（locationbar/toolbar 等一族）冲突。
 */
import { contextBridge, ipcRenderer } from 'electron'
import { ToolbarChannels, type ToolbarItem } from './src/ipc/toolbarChannels'

const workbarApi = {
  getItems: (): Promise<ToolbarItem[]> => ipcRenderer.invoke(ToolbarChannels.getItems),
  activate: (item: ToolbarItem): Promise<string> =>
    ipcRenderer.invoke(ToolbarChannels.activate, item),
  hide: (): Promise<void> => ipcRenderer.invoke(ToolbarChannels.hide)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('workbar', workbarApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.workbar = workbarApi
}
