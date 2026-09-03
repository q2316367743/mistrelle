/**
 * browserTool 执行器（main）：browser_fetch / browser_actions 两个 AI 工具的浏览器执行核心。
 *
 * 精简设计（替代被删除的完整 cBrowser 实现）：
 * - 直接在主进程创建隐藏 BrowserWindow，**进程内顺序执行**，无 runner 子进程、无窗口池
 * - `fetch`：导航 → 等待渲染 → 提取 markdown / text / html
 * - `actions`：解释工具步骤数组（goto/click/value/evaluate/wait/...），返回最后一个非 undefined 结果
 * - 页内执行函数见 ./pageScripts，键码映射见 ./keyCodes
 */

import { BrowserWindow, clipboard, nativeImage, app, session } from 'electron'
import path from 'path'
import fs from 'fs'
import TurndownService from 'turndown'
import type {
  BrowserToolActionStep,
  BrowserToolActionsPayload,
  BrowserToolFetchPayload,
  BrowserToolPayload,
  BrowserToolResult
} from '~/modules/browser/browserChannels'
import {
  callCode,
  dispatchClick,
  extractHtml,
  extractText,
  scrollToElement,
  scrollToXY,
  scrollToY,
  setValue,
  waitForSelectorCode
} from './pageScripts'
import { resolveKeyCode } from './keyCodes'

/** 全局执行超时（5 分钟，防页面卡死） */
const EXECUTION_TIMEOUT = 5 * 60 * 1000

/** goto 默认超时（60 秒） */
const DEFAULT_GOTO_TIMEOUT = 60_000

/** 截图默认保存目录 */
const TEMP_DIR = 'browserTool'

const waitTime = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export class BrowserToolRunner {
  private _win: BrowserWindow | null = null
  /** 页面是否已触发 dom-ready（goto 后为 true） */
  private _pageReady = false

  async run(payload: BrowserToolPayload): Promise<BrowserToolResult> {
    return new Promise((resolve) => {
      // 全局超时保护：页面卡死时销毁窗口并返回错误
      const timer = setTimeout(() => {
        console.error('[browserTool] 执行超时，强制终止')
        this._destroy()
        resolve({ data: [], error: true, message: 'browserTool execution timeout' })
      }, EXECUTION_TIMEOUT)

      this._execute(payload)
        .then((result) => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch((error) => {
          clearTimeout(timer)
          const message = error instanceof Error ? error.message : String(error)
          console.error(`[browserTool] 执行失败: ${message}`)
          resolve({ data: [], error: true, message })
        })
        .finally(() => {
          this._destroy()
        })
    })
  }

  private async _execute(payload: BrowserToolPayload): Promise<BrowserToolResult> {
    const options = payload.kind === 'actions' ? payload.options : undefined
    this._win = this._createWindow(options)
    if (options?.show === true) this._win.show()

    const data = payload.kind === 'fetch' ? await this._runFetch(payload) : await this._runActions(payload)
    return { data }
  }

  // ── fetch：导航 → 等待 → 提取 ──

  private async _runFetch(payload: BrowserToolFetchPayload): Promise<unknown[]> {
    await this.goto(payload.url)
    await waitTime(payload.waitMs ?? 3000)
    if (payload.mode === 'html') {
      return [await this.javascript(callCode(extractHtml, payload.selector))]
    }
    if (payload.mode === 'text') {
      return [await this.javascript(callCode(extractText, payload.selector))]
    }
    return [await this.markdown(payload.selector)]
  }

  // ── actions：顺序解释工具步骤 ──

  private async _runActions(payload: BrowserToolActionsPayload): Promise<unknown[]> {
    const results: unknown[] = []
    for (const step of payload.steps) {
      const result = await this._execStep(step)
      if (result !== undefined) results.push(result)
    }
    return results
  }

  private async _execStep(step: BrowserToolActionStep): Promise<unknown> {
    switch (step.type) {
      case 'goto':
        await this.goto(
          step.url as string,
          step.headers as Record<string, string> | undefined,
          step.timeout as number
        )
        return
      case 'click':
        return this.javascript(callCode(dispatchClick, step.selector as string))
      case 'value':
        return this.javascript(callCode(setValue, step.selector as string, step.value as string))
      case 'evaluate': {
        const args = (step.args as unknown[]) || []
        const paramNames = args.map((_, i) => `$${i}`)
        const fn = new Function(...paramNames, step.script as string)
        return this.javascript(`(${String(fn)})(${args.map((a) => JSON.stringify(a)).join(',')})`)
      }
      case 'wait':
        if (step.selector) {
          const timeout = typeof step.timeout === 'number' && step.timeout > 0 ? step.timeout : 60000
          await this._waitForSelector(step.selector as string, timeout)
          return
        }
        await waitTime(
          typeof step.ms === 'number' ? step.ms : typeof step.timeout === 'number' ? step.timeout : 30000
        )
        return
      case 'screenshot':
        return this.screenshot(step.selector as string | undefined, step.savePath as string | undefined)
      case 'press':
        return this.press(step.key as string, ...((step.modifiers as string[]) || []))
      case 'paste':
        return this.paste(step.text as string | undefined)
      case 'scroll':
        if (step.selector) return this.javascript(callCode(scrollToElement, step.selector))
        if (typeof step.x === 'number' && typeof step.y === 'number') {
          return this.javascript(callCode(scrollToXY, step.x, step.y))
        }
        if (typeof step.y === 'number') return this.javascript(callCode(scrollToY, step.y))
        return
      case 'cookies':
        return this._execCookies(step)
      case 'getHtml':
        return this.javascript(callCode(extractHtml, step.selector as string | undefined))
      case 'getText':
        return this.javascript(callCode(extractText, step.selector as string | undefined))
      case 'getTitle':
        return this.javascript('document.title')
      case 'hide':
        return this.hide()
      case 'show':
        return this.show()
      case 'viewport':
        return this.viewport(step.width as number, step.height as number)
      case 'useragent':
        return this.useragent(step.userAgent as string)
      case 'css':
        return this.css(step.css as string)
      default:
        return
    }
  }

  private async _execCookies(step: BrowserToolActionStep): Promise<unknown> {
    switch (step.action) {
      case 'get':
        if (step.filter) return this.cookies(step.filter as Record<string, unknown>)
        return this.cookies(step.name as string | undefined)
      case 'set':
        if (step.name !== undefined && step.value !== undefined) {
          return this.setCookies(step.name as string, step.value as string)
        }
        if (Array.isArray(step.cookies)) {
          return this.setCookies(step.cookies as Array<{ name: string; value: string }>)
        }
        return
      case 'remove':
        return this.removeCookies(step.name as string)
      case 'clear':
        return this.clearCookies(step.url as string | undefined)
      default:
        return this.cookies()
    }
  }

  // ── 浏览器操作 ──

  /** 页面导航（支持 headers / 自定义超时，dom-ready 后返回） */
  private async goto(
    url: string,
    headers?: Record<string, string>,
    timeout?: number
  ): Promise<void> {
    if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
      throw new Error('url error')
    }

    let loadOptions: Electron.LoadURLOptions | undefined
    let t = DEFAULT_GOTO_TIMEOUT
    if (headers && typeof headers === 'object') {
      loadOptions = { extraHeaders: '' }
      for (const [key, value] of Object.entries(headers)) {
        const lowerKey = key.toLowerCase()
        if (lowerKey === 'referer') loadOptions.httpReferrer = value
        else if (lowerKey === 'useragent') loadOptions.userAgent = value
        else loadOptions.extraHeaders += `${key}: ${value}\n`
      }
    }
    if (typeof timeout === 'number' && timeout > 0) t = timeout

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('page load timeout')), t)
      this._win!.webContents.once('dom-ready', () => {
        clearTimeout(timer)
        this._pageReady = true
        resolve()
      })
      this._win!.loadURL(url, loadOptions).catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
    })
  }

  /** 在页面中执行 JS 代码，返回原始结果（抛错则 reject） */
  private async javascript(code: string): Promise<unknown> {
    if (!this._pageReady) throw new Error('"goto" method did not executed')
    return this._win!.webContents.executeJavaScript(code, true)
  }

  /** 将网页内容转换为 Markdown */
  private async markdown(selector?: string): Promise<string> {
    if (!this._pageReady) throw new Error('"goto" method did not executed')
    const html = await this.javascript(
      selector ? callCode(extractHtml, selector) : 'document.body.innerHTML'
    )
    if (html === null) throw new Error(`markdown: unable to find element by selector "${selector}"`)
    const ts = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
    return ts.turndown(html as string)
  }

  /** 轮询等待选择器出现 */
  private async _waitForSelector(selector: string, timeout: number): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const ok = await this.javascript(waitForSelectorCode(selector))
      if (ok === true) return
      await waitTime(1000)
    }
    throw new Error(`wait: ${timeout} ms timeout`)
  }

  /** 模拟键盘按键（sendInputEvent） */
  private async press(key: string, ...modifiers: string[]): Promise<void> {
    if (!this._pageReady) throw new Error('"goto" method did not executed')

    const keyCode = resolveKeyCode(key)
    if (!keyCode) throw new Error('keyCode error')

    if (modifiers.length > 0) {
      modifiers = Array.from(new Set(modifiers)).map((m) => String(m).toLowerCase())
      const invalid = modifiers.find((m) => !['shift', 'ctrl', 'alt', 'meta'].includes(m))
      if (invalid) throw new Error('modifier key error')
    }

    const wc = this._win!.webContents
    wc.sendInputEvent({ type: 'keyDown', keyCode, modifiers } as Electron.KeyboardInputEvent)
    wc.sendInputEvent({
      type: 'char',
      keyCode: /^[A-Z]$/.test(keyCode) ? key : keyCode,
      modifiers
    } as Electron.KeyboardInputEvent)
    wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers } as Electron.KeyboardInputEvent)
  }

  /** 粘贴文本或图片（document.execCommand('paste')，与 uTools 一致） */
  private async paste(text?: string): Promise<void> {
    if (text) {
      if (/^data:image\/[a-z]+?;base64,/.test(text)) {
        clipboard.writeImage(nativeImage.createFromDataURL(text))
      } else {
        clipboard.writeText(text)
      }
    }
    await this._win!.webContents.executeJavaScript("document.execCommand('paste')")
  }

  /** 截图（selector 模式：滚动定位元素；省略则整页） */
  private async screenshot(selector?: string, savePath?: string): Promise<string> {
    if (!this._pageReady) throw new Error('"goto" method did not executed')

    let rect: Electron.Rectangle | undefined
    if (selector) {
      const code = `(() => {
        const el = document.querySelector(${JSON.stringify(selector)})
        if (!el) return null
        let r = el.getBoundingClientRect()
        window.scrollTo(r.left, r.top)
        r = el.getBoundingClientRect()
        return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }
      })()`
      const pos = (await this.javascript(code)) as Electron.Rectangle | null
      if (!pos) throw new Error(`unable to find element by selector "${selector}"`)
      rect = pos
    }

    const image = await this._win!.webContents.capturePage(rect)
    if (image.isEmpty()) throw new Error('capture image destroyed')

    let dir: string
    let fileName: string | undefined
    if (savePath) {
      const resolvedPath = path.resolve(savePath)
      const tempBase = app.getPath('temp')
      const downloadBase = app.getPath('downloads')
      if (!resolvedPath.startsWith(tempBase) && !resolvedPath.startsWith(downloadBase)) {
        throw new Error('save path must be within temp or downloads directory')
      }
      if (/\.png$/i.test(savePath)) {
        dir = path.dirname(resolvedPath)
        fileName = path.basename(resolvedPath)
      } else {
        dir = resolvedPath
      }
      if (!fs.existsSync(dir)) throw new Error('save directory not exist')
    } else {
      dir = path.join(app.getPath('temp'), TEMP_DIR)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    }

    const filePath = path.join(dir, fileName || `${Date.now()}.png`)
    fs.writeFileSync(filePath, image.toPNG())
    return filePath
  }

  /** 获取 Cookie（cookies(name) 返回单个；cookies(filter) / cookies() 返回数组） */
  private async cookies(nameOrFilter?: string | Record<string, unknown>): Promise<unknown> {
    const wc = this._win!.webContents
    const filter: Electron.CookiesGetFilter = {}
    if (typeof nameOrFilter === 'string' && nameOrFilter) {
      filter.url = wc.getURL()
      filter.name = nameOrFilter
    } else if (nameOrFilter && typeof nameOrFilter === 'object') {
      Object.assign(filter, nameOrFilter)
      if (!filter.url) filter.url = wc.getURL()
    } else {
      filter.url = wc.getURL()
    }
    const cookies = await wc.session.cookies.get(filter)
    return typeof nameOrFilter === 'string' && nameOrFilter
      ? cookies.length > 0
        ? cookies[0]
        : null
      : cookies
  }

  /** 设置 Cookie（name/value 或数组两种签名） */
  private async setCookies(
    ...args: [string, string] | [Array<{ name: string; value: string }>]
  ): Promise<void> {
    const sess = this._win!.webContents.session
    const url = this._pageReady ? this._win!.webContents.getURL() : 'http://localhost'
    if (args.length === 2 && typeof args[0] === 'string') {
      await sess.cookies.set({ url, name: args[0], value: args[1] })
    } else if (Array.isArray(args[0])) {
      for (const cookie of args[0]) {
        await sess.cookies.set({ ...cookie, url })
      }
    }
  }

  /** 删除指定名称的 Cookie */
  private async removeCookies(name: string): Promise<void> {
    if (!this._pageReady) throw new Error('"goto" method did not executed')
    const url = this._win!.webContents.getURL()
    await this._win!.webContents.session.cookies.remove(url, name)
  }

  /** 清除 Cookie（页面未加载时 url 必传） */
  private async clearCookies(url?: string): Promise<void> {
    const sess = this._win!.webContents.session
    const targetUrl = this._pageReady ? this._win!.webContents.getURL() : url
    if (!targetUrl) throw new Error('url is required when page is not loaded')
    const cookies = await sess.cookies.get({ url: targetUrl })
    for (const cookie of cookies) {
      await sess.cookies.remove(targetUrl, cookie.name)
    }
  }

  /** 设置视口大小 */
  private async viewport(width: number, height: number): Promise<void> {
    this._win!.setContentSize(width, height)
  }

  /** 设置 UserAgent */
  private async useragent(ua: string): Promise<void> {
    this._win!.webContents.userAgent = ua
  }

  /** 隐藏窗口 */
  private async hide(): Promise<void> {
    this._win!.hide()
  }

  /** 显示窗口 */
  private async show(): Promise<void> {
    this._win!.show()
  }

  /** 注入 CSS */
  private async css(code: string): Promise<void> {
    if (!this._pageReady) throw new Error('"goto" method did not executed')
    await this._win!.webContents.insertCSS(code)
  }

  // ── 窗口生命周期 ──

  /** 创建隐藏 BrowserWindow（隔离 session，窗口选项白名单过滤） */
  private _createWindow(options?: BrowserToolActionsPayload['options']): BrowserWindow {
    const winOptions: Electron.BrowserWindowConstructorOptions = {
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        session: session.fromPartition('browserTool')
      }
    }

    const allowedKeys = [
      'width',
      'height',
      'x',
      'y',
      'center',
      'minWidth',
      'minHeight',
      'maxWidth',
      'maxHeight',
      'resizable',
      'movable',
      'minimizable',
      'maximizable',
      'alwaysOnTop',
      'fullscreen',
      'fullscreenable',
      'opacity',
      'frame',
      'closable',
      'focusable',
      'skipTaskbar',
      'backgroundColor',
      'hasShadow',
      'transparent',
      'titleBarStyle',
      'thickFrame'
    ] as const
    if (options) {
      for (const key of allowedKeys) {
        const value = (options as Record<string, unknown>)[key]
        if (value !== undefined) (winOptions as Record<string, unknown>)[key] = value
      }
    }

    return new BrowserWindow(winOptions)
  }

  /** 销毁窗口 */
  private _destroy(): void {
    if (this._win && !this._win.isDestroyed()) {
      this._win.destroy()
    }
    this._win = null
  }
}
