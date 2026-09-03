/**
 * 伙伴窗口模块：独立 HTML 入口（renderer/buddy.html → nested/buddy/），承载硬件控制等独立页面。
 * 默认隐藏——启动不创建，首次从托盘「打开伙伴」进入（showBuddyWindow 唯一入口）；
 * 关闭只隐藏（复用主窗口 isQuitting 置位放行真关闭），串口连接在主进程不随窗口关闭中断。
 */
import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { isAppQuitting, windowOptions } from './aiWindow'

let buddyWindow: BrowserWindow | null = null

/** 创建并显示伙伴窗口（已存在则还原/聚焦） */
export function showBuddyWindow(): void {
  if (!buddyWindow || buddyWindow.isDestroyed()) {
    createBuddyWindow()
    return
  }
  if (buddyWindow.isMinimized()) buddyWindow.restore()
  buddyWindow.show()
  buddyWindow.focus()
}

function createBuddyWindow(): void {
  const win = new BrowserWindow({
    ...windowOptions(),
    width: 960,
    height: 640,
    minWidth: 720,
    minHeight: 480,
    title: '伙伴'
  })
  buddyWindow = win

  win.on('ready-to-show', () => {
    win.show()
    win.focus()
  })

  // 关闭只隐藏：串口状态等在主进程存活，窗口常驻避免重复创建开销
  win.on('close', (event) => {
    if (isAppQuitting()) return
    event.preventDefault()
    win.hide()
  })

  win.on('closed', () => {
    if (buddyWindow === win) buddyWindow = null
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 同主窗口的导航劫持防护，放行对象换成 buddy.html
  win.webContents.on('will-navigate', (event, url) => {
    const devUrl = is.dev ? process.env['ELECTRON_RENDERER_URL'] : ''
    const allowed = devUrl
      ? url.startsWith(new URL(devUrl).origin)
      : url.startsWith(`file://${join(__dirname, '../renderer/buddy.html')}`)
    if (!allowed) event.preventDefault()
  })

  // HMR for renderer base on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/buddy.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/buddy.html'))
  }
}
