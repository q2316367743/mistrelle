/**
 * AI 主窗口模块：启动即创建（index.ts 调 createAiWindow），默认隐藏；
 * 关闭只隐藏（before-quit 置位放行真关闭），入口为托盘「显示 AI 窗口」/ Dock 点击。
 */
import { BrowserWindow, shell } from 'electron'
import type { BrowserWindowConstructorOptions } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '@resources/icon.png?asset'
import { ensureMacDockVisible, trackMacDockWindow } from './macDock'

const WINDOW_BACKGROUND = '#F4F4F4'

function windowOptions(): BrowserWindowConstructorOptions {
  // 导出给 buddyWindow 等二级窗口复用（尺寸/标题可覆盖）
  // 标题栏与背景同色 + 背景高斯模糊，按平台差异配置：
  // - darwin：hiddenInset 隐藏标题栏（保留交通灯）+ vibrancy 系统毛玻璃 + 透明背景
  // - win32 ：hidden + titleBarOverlay（原生控制按钮）+ acrylic 毛玻璃 + 透明背景让其生效
  // - linux ：hidden + titleBarOverlay + 实色背景（无毛玻璃能力）
  const platformOptions: Partial<
    Record<NodeJS.Platform, Partial<BrowserWindowConstructorOptions>>
  > = {
    darwin: {
      titleBarStyle: 'hiddenInset',
      // hiddenInset 默认交通灯位置 (12, 11)；显式指定后 Electron 源码中会优先于默认值，
      // 借此将按钮整体下移 8px（y 11 -> 19）
      trafficLightPosition: { x: 8, y: 17 },
      vibrancy: 'under-window',
      visualEffectState: 'active',
      backgroundColor: '#00000000'
    },
    win32: {
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: WINDOW_BACKGROUND, symbolColor: '#000000', height: 40 },
      backgroundMaterial: 'acrylic',
      backgroundColor: '#00000000'
    },
    linux: {
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: WINDOW_BACKGROUND, symbolColor: '#000000', height: 40 },
      backgroundColor: WINDOW_BACKGROUND
    }
  }

  return {
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(platformOptions[process.platform] ?? { backgroundColor: WINDOW_BACKGROUND }),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: true,
      // 链接预览抽屉的内嵌浏览器（<webview> 标签）需要显式开启；webview 拥有独立
      // webContents，不受下方 will-navigate 守卫影响，弹窗处理见 did-attach-webview
      webviewTag: true
    }
  }
}

export { windowOptions }

let mainWindow: BrowserWindow | null = null
let isQuitting = false

/** 退出流程置位（index.ts 在 before-quit 时调用）：此后关闭才放行真销毁 */
export function markQuitting(): void {
  isQuitting = true
}

/** 二级窗口（buddyWindow）读取退出置位，决定 close 是否放行 */
export function isAppQuitting(): boolean {
  return isQuitting
}

/** 启动即创建（默认显示；已存在则忽略） */
export function createAiWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) return
  const win = new BrowserWindow(windowOptions())
  mainWindow = win
  trackMacDockWindow('ai', win)

  // 默认隐藏
  // win.on('ready-to-show', () => {
  //   win.show()
  // })

  // 关闭只隐藏：窗口与 webContents 常驻，避免销毁后 IPC / 流式回调打到空引用（闪退根因之一）
  win.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    win.hide()
  })

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 拦截窗口内导航：拖入文件落在非输入区时默认会让 webContents 导航到磁盘文件（file://）劫持窗口。
  // 只放行应用自身地址（dev 同源以保 HMR 刷新，prod 允许自身 index.html），其余一律吞掉。
  win.webContents.on('will-navigate', (event, url) => {
    const devUrl = is.dev ? process.env['ELECTRON_RENDERER_URL'] : ''
    const allowed = devUrl
      ? url.startsWith(new URL(devUrl).origin)
      : url.startsWith(`file://${join(__dirname, '../renderer/index.html')}`)
    if (!allowed) event.preventDefault()
  })

  // webview（链接预览抽屉）内的 _blank / window.open：Electron 22+ 已移除 new-window 事件，
  // 且上方宿主 setWindowOpenHandler 不覆盖 guest，须在 guest 附着时单独挂 handler——
  // 配合 webview 的 allowpopups 属性放行弹窗请求，再统一转系统浏览器并拒绝建窗
  win.webContents.on('did-attach-webview', (_, wc) => {
    wc.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.webContents.addListener('did-finish-load', () => {
    win.show()
  })

}

/** 显示 AI 主窗口（已创建则还原/聚焦；意外销毁则重建） */
export function showAiWindow(): void {
  // 先恢复 Dock 再 show：Dock 隐藏态（accessory）下直接 show 拿不到键盘焦点
  ensureMacDockVisible()
  if (!mainWindow || mainWindow.isDestroyed()) createAiWindow()
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}
