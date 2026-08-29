/**
 * 工作条窗口：uTools 式顶部悬浮搜索条。启动即创建（index.ts 调 createToolbarWindow，默认隐藏），
 * Alt+Space / 托盘唤起，失焦即隐藏，无控制按钮。
 */
import { app, BrowserWindow, globalShortcut, screen } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'

const TOOLBAR_WIDTH = 640
const TOOLBAR_HEIGHT = 480
/** 距所在屏幕 workArea 顶部的间距 */
const TOP_OFFSET = 96
/** uTools 同款默认快捷键（macOS 显示为 ⌥Space） */
const TOGGLE_SHORTCUT = 'Alt+Space'

let toolbarWindow: BrowserWindow | null = null
/** 首页加载完成标记：ready-to-show 前不响应展示，避免透明窗闪烁 */
let toolbarReady = false

function createToolbarWindowInternal(): BrowserWindow {
  const win = new BrowserWindow({
    width: TOOLBAR_WIDTH,
    height: TOOLBAR_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/toolbar.js'),
      sandbox: false
    }
  })

  // 失焦即隐藏（uTools 行为）；devtools 打开会令窗口失焦，跳过以免调试窗口被吞
  win.on('blur', () => {
    if (!win.webContents.isDevToolsOpened()) win.hide()
  })

  win.on('closed', () => {
    if (toolbarWindow === win) toolbarWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/toolbar.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/toolbar.html'))
  }

  return win
}

/** 启动即创建（默认隐藏；已存在则忽略） */
export function createToolbarWindow(): void {
  if (toolbarWindow && !toolbarWindow.isDestroyed()) return
  toolbarWindow = createToolbarWindowInternal()
  toolbarReady = false
  toolbarWindow.once('ready-to-show', () => {
    toolbarReady = true
  })
}

/** 移动到光标所在屏幕的 workArea 顶部居中（多显示器跟随光标） */
function positionToolbar(win: BrowserWindow): void {
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { width } = win.getBounds()
  win.setPosition(workArea.x + Math.round((workArea.width - width) / 2), workArea.y + TOP_OFFSET)
}

function present(win: BrowserWindow): void {
  positionToolbar(win)
  win.show()
  // macOS 下应用未激活时 show+focus 可能上不了前台：强制激活应用（launcher 语义）+ moveTop
  if (process.platform === 'darwin') app.focus({ steal: true })
  win.focus()
  win.moveTop()
}

/** 窗口异常销毁时重建（正常流程无关闭入口） */
function ensureToolbar(): void {
  if (toolbarWindow && !toolbarWindow.isDestroyed()) return
  createToolbarWindow()
}

/** 唤起工作条（托盘 / Dock 入口）：已可见则忽略 */
export function showToolbar(): void {
  ensureToolbar()
  if (!toolbarWindow || !toolbarReady || toolbarWindow.isVisible()) return
  present(toolbarWindow)
}

/** 唤起 / 隐藏切换（全局快捷键入口） */
export function toggleToolbar(): void {
  ensureToolbar()
  if (!toolbarWindow || !toolbarReady) return
  if (toolbarWindow.isVisible()) {
    toolbarWindow.hide()
  } else {
    present(toolbarWindow)
  }
}

/** 隐藏工作条（IPC: toolbar:hide） */
export function hideToolbar(): void {
  toolbarWindow?.hide()
}

/** 注册全局快捷键（app ready 后调用） */
export function registerToolbarShortcut(): void {
  globalShortcut.register(TOGGLE_SHORTCUT, toggleToolbar)
}

/** 注销全局快捷键（app will-quit 时调用） */
export function unregisterToolbarShortcut(): void {
  globalShortcut.unregister(TOGGLE_SHORTCUT)
}