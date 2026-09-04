import { app } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createAiWindow, markQuitting, showAiWindow } from '$/app/aiWindow'
import { init as initAuth } from '$/modules/auth/AuthService'
import { registerIpc } from '$/registerIpc'
import {
  captureOpenUrl,
  registerDeepLink,
  registerLocalSchemes,
  registerLocalProtocol,
  startEventSocket
} from '$/app/protocol'
import { registerAppTray } from '$/app/tray'

// 单实例锁：外部 open mistrelle:// 二次唤起时把 argv 交给首实例 second-instance 处理，
// 避免重复拉起新进程（URL 接收见 protocol.ts handleExternalUrl）
const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  // 在 app ready 之前注册 mistrelle:// 为特权 scheme（渲染层经自定义协议加载本地字体 / 图片，
  // 规避 dev 下 http 页面加载 file:// 被 Chromium 拦截）
  registerLocalSchemes()

  // 挂 macOS open-url 监听（ready 前可能触发，内部做暂存；随 ready 后 registerDeepLink 补收）
  captureOpenUrl()
}

// AI 主窗口默认显示（关闭只隐藏，退出走托盘菜单）
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

    // 注册 mistrelle:// 协议处理（依赖 registerLocalSchemes 已就绪）
    registerLocalProtocol()

    // 注册为系统级 mistrelle:// 协议客户端 + second-instance/open-url 接收（外部 open 不弹窗）
    registerDeepLink()

    // 本地事件 socket 主通道（opencode 插件等直连投递，不经系统唤起、不抢焦点）
    startEventSocket()

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
