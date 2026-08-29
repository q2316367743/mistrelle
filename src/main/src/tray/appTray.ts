/**
 * 应用托盘：常驻入口——显示 AI 窗口 / 退出。
 * 单击托盘不做任何动作（macOS 挂右键菜单后单击即弹菜单；Windows/Linux 单击无动作）。
 */
import { Menu, Tray, app } from 'electron'
import appIcon from '@resources/icon16.png?asset'
import { showAiWindow } from '$/aiWindow/aiWindow'

let tray: Tray | null = null

export function registerAppTray(): void {
  tray = new Tray(appIcon)
  tray.setToolTip('半窗烟雨')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示 AI 窗口', click: showAiWindow },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ])
  )
}