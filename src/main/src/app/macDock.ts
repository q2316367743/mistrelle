/**
 * macOS Dock 联动（非 darwin 平台全部空操作，app.dock 仅 macOS 存在）：
 * 对齐 Windows「任务栏随窗口」的体验——任一窗口可见才显示 Dock，全部隐藏即隐藏 Dock。
 * Dock 隐藏后应用转为 accessory（点击事件不再触发），唤醒窗口只剩托盘菜单。
 * 本模块只依赖 electron，不 import 任何 app 内部模块，避免循环依赖；
 * 窗口通过 trackMacDockWindow 登记进来，activate 分流所需的 show 函数由 index.ts 注入调用。
 */
import { app } from 'electron'
import type { BrowserWindow } from 'electron'

/** Dock 联动管辖的窗口名 */
type MacDockWindowName = 'ai' | 'buddy'

// 登记的常驻窗口：close 只隐藏、实例长期存活，仅退出真销毁（closed）时移除
const dockWindows = new Map<MacDockWindowName, BrowserWindow>()

function isWindowVisible(name: MacDockWindowName): boolean {
  const win = dockWindows.get(name)
  // 最小化不算隐藏：isVisible 对最小化窗口仍为 true，Dock 保持显示，点 Dock 走 restore
  return !!win && !win.isDestroyed() && win.isVisible()
}

/** 取 Dock 实例（类型上 app.dock 可能为 undefined，借平台判断收窄，非 darwin 返回 undefined 即空操作） */
function getDock(): Electron.Dock | undefined {
  return process.platform === 'darwin' ? app.dock : undefined
}

/** 显示窗口前调用：Dock 隐藏态（accessory）下先恢复显示，否则随后的 show/focus 拿不到键盘焦点 */
export function ensureMacDockVisible(): void {
  const dock = getDock()
  if (!dock || dock.isVisible()) return
  dock.show()
  // 激活策略 accessory → Regular 的切换存在时序差，主动抢焦点保证 show 后可立即键入
  app.focus({ steal: true })
}

/** 按窗口可见性同步 Dock：任一可见 → 显示；全部隐藏 → 隐藏 */
export function syncMacDock(): void {
  const dock = getDock()
  if (!dock) return
  const anyVisible = isWindowVisible('ai') || isWindowVisible('buddy')
  if (anyVisible === dock.isVisible()) return
  if (anyVisible) dock.show()
  else dock.hide()
}

/** 建窗时登记：监听 show/hide 驱动 Dock 同步，真销毁时移除 */
export function trackMacDockWindow(name: MacDockWindowName, win: BrowserWindow): void {
  dockWindows.set(name, win)
  win.on('show', syncMacDock)
  win.on('hide', syncMacDock)
  win.once('closed', () => {
    if (dockWindows.get(name) === win) dockWindows.delete(name)
  })
}

/** 只读查询：指定窗口当前是否可见（供 activate 分流判断） */
export function isMacDockWindowVisible(name: MacDockWindowName): boolean {
  return isWindowVisible(name)
}
