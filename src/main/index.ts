import { app } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createAiWindow, markQuitting } from '$/aiWindow/aiWindow'
import { registerIpc } from '$/ipc/registerIpc'
import { registerLocalSchemes, registerLocalProtocol } from '$/protocol'
import { registerAppTray } from '$/tray/appTray'
import {
  createToolbarWindow,
  registerToolbarShortcut,
  showToolbar,
  unregisterToolbarShortcut
} from '$/toolbar/toolbarWindow'

// 在 app ready 之前注册 mistrelle:// 为特权 scheme（渲染层经自定义协议加载本地字体 / 图片，
// 规避 dev 下 http 页面加载 file:// 被 Chromium 拦截）
registerLocalSchemes()

// 启动即建双窗口：AI 窗口默认显示（关闭只隐藏），工作条默认隐藏（Alt+Space / 托盘唤起）
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('xyz.esion')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 注册全部业务 IPC（shell/dialog/clipboard/os/display/notification/fs/net/shellExec/font/db/ffmpeg/sharp/toolbar）
  registerIpc()

  // 注册 mistrelle:// 协议处理（依赖 registerLocalSchemes 已就绪）
  registerLocalProtocol()

  // 托盘常驻入口（macOS 菜单栏 / Windows 通知区）
  registerAppTray()

  // 注册工作条全局快捷键（Alt+Space 唤起顶部悬浮搜索条）
  registerToolbarShortcut()

  // 创建工作条（隐藏）与 AI 主窗口（默认显示）
  createToolbarWindow()
  createAiWindow()

  // macOS 点击 Dock 图标唤起工具条
  app.on('activate', showToolbar)
})

// 退出流程放行窗口真关闭（AI 窗口的 close 拦截在置位后不再 preventDefault）
app.on('before-quit', markQuitting)

// 窗口全关不退出（关闭=隐藏，本事件几乎不触发；防御性保留），退出走托盘菜单
app.on('window-all-closed', () => {})

// 注销工作条全局快捷键，避免残留系统级热键
app.on('will-quit', unregisterToolbarShortcut)
