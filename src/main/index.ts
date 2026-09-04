import { app } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createAiWindow, markQuitting, showAiWindow } from '$/app/aiWindow'
import { init as initAuth } from '$/modules/auth/AuthService'
import { registerIpc } from '$/registerIpc'
import { startEventServer } from '$/server'
import { registerAppTray } from '$/app/tray'

// 单实例锁：二次拉起直接退出（事件/资源统一走本地事件服务，无需 second-instance 接收 argv）
const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
}

if (hasSingleInstanceLock) {
  app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('xyz.esion')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // 注册全部业务 IPC（shell/dialog/clipboard/os/display/notification/fs/net/shellExec/font/db/sharp）
    registerIpc()

    // 服务端账号初始化（读本地凭证校验登录态，非阻塞，失败不阻塞启动）
    initAuth()

    // 本地事件服务（127.0.0.1:47743：渲染层资源面 /file + 外部事件面 /<模块>/<功能>），
    // 先于建窗启动，保证渲染层字体 / 图片等子资源可达
    startEventServer()

    // 托盘常驻入口（macOS 菜单栏 / Windows 通知区）
    registerAppTray()

    // 创建 AI 主窗口（默认显示）
    createAiWindow()

    // macOS 点击 Dock 图标打开 AI 主窗口
    app.on('activate', showAiWindow)
  })

  // 退出流程放行窗口真关闭（AI 窗口的 close 拦截在置位后不再 preventDefault）
  app.on('before-quit', markQuitting)

  // 窗口全关不退出（关闭=隐藏，本事件几乎不触发；防御性保留），退出走托盘菜单
  app.on('window-all-closed', () => {})
}
