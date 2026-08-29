/**
 * 工作条域 IPC：条目列表 / 激活（应用启动、内置功能分发）/ 隐藏窗口。
 * 图标不走 IPC：应用图标经 mistrelle://icon/<target> 协议加载（见 protocol.ts）。
 */
import { ipcMain, shell } from 'electron'
import { ToolbarChannels, type ToolbarItem } from '~/ipc/toolbarChannels'
import { getBuiltinItems } from '$/toolbar/builtinItems'
import { getInstalledApps } from '$/toolbar/appScanner'
import { hideToolbar } from '$/toolbar/toolbarWindow'
import { showAiWindow } from '$/aiWindow/aiWindow'

export function registerToolbarIpc(): void {
  // 内置应用排最前，其后为按名称排序的系统应用
  ipcMain.handle(ToolbarChannels.getItems, async () => [
    ...getBuiltinItems(),
    ...(await getInstalledApps())
  ])
  ipcMain.handle(ToolbarChannels.activate, (_event, item: ToolbarItem) => activateItem(item))
  ipcMain.handle(ToolbarChannels.hide, () => hideToolbar())
}

async function activateItem(item: ToolbarItem): Promise<string> {
  if (item.type === 'builtin') {
    if (item.target === 'ai') showAiWindow()
    return ''
  }
  // 校验目标来自扫描列表，防止渲染层伪造任意路径启动
  const apps = await getInstalledApps()
  if (!apps.some((app) => app.target === item.target)) return '未知应用'
  return shell.openPath(item.target)
}