import { app, shell, BrowserWindow, ipcMain } from 'electron'
import type { BrowserWindowConstructorOptions } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpc } from '$/ipc/registerIpc'
import { registerLocalSchemes, registerLocalProtocol } from '$/protocol'
import icon from '../../resources/icon.png?asset'

// 在 app ready 之前注册 mistrelle:// 为特权 scheme（渲染层经自定义协议加载本地字体 / 图片，
// 规避 dev 下 http 页面加载 file:// 被 Chromium 拦截）
registerLocalSchemes()

const WINDOW_BACKGROUND = '#F4F4F4'

function windowOptions(): BrowserWindowConstructorOptions {
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
      nodeIntegration: true
    }
  }
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow(windowOptions())

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // 注册全部业务 IPC（shell/dialog/clipboard/os/display/notification/fs/net/shellExec/font/db/ffmpeg/sharp）
  registerIpc()

  // 注册 mistrelle:// 协议处理（依赖 registerLocalSchemes 已就绪）
  registerLocalProtocol()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // if (process.platform !== 'darwin') {
  //   app.quit()
  // }
  // 获取全部的窗口
  const windows = BrowserWindow.getAllWindows()
  if (windows.length === 0) app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
