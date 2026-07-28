import { ToolFunction } from '@/domain'

type CbStep = Record<string, any>

const uBrowserAutomationTools: ToolFunction[] = [
  {
    name: 'browser_actions',
    label: '浏览器自动化操作',
    description: `Perform browser automation actions (navigation, clicking, form filling, script execution, screenshots, etc.) using a headless/visible browser instance.

Default behavior: If the user does NOT explicitly request to show the browser window (via "show" step or options.show), the browser runs HIDDEN (hide() is applied automatically). Only use show() when the user explicitly asks to observe the process or interact visually.

Steps are executed in order. The return value is the result of the last evaluate/getHtml/getText/getTitle step. If there are no evaluate-like steps, the return value is undefined.

Supported step types:
- goto: Navigate to URL. Fields: url, headers?, timeout?
- click: Click an element. Fields: selector
- value: Set input/textarea value. Fields: selector, value
- evaluate: Execute JS in page context. Fields: script (function body, use "return" for result), args? (array, accessible as $0, $1...)
- wait: Wait for time (ms?) or element (selector?, timeout?)
- screenshot: Take screenshot. Fields: selector?, savePath?
- press: Keyboard press. Fields: key, modifiers? (ctrl/shift/alt/meta)
- paste: Paste text/image. Fields: text?
- scroll: Scroll to element (selector?), position (x?, y?), or pixels (y?)
- cookies: Manage cookies. Fields: action (get/set/remove/clear), name?, value?, url?, filter?, cookies?
- getHtml: Get page HTML (document.documentElement.outerHTML)
- getText: Get page text (document.body.innerText)
- getTitle: Get page title (document.title)
- hide: Hide browser window
- show: Show browser window
- viewport: Set viewport size. Fields: width, height
- useragent: Set user agent. Fields: userAgent
- css: Inject CSS styles. Fields: css`,
    parameters: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          description:
            'Array of browser operations to perform in sequence. Each step must have a "type" field and optionally type-specific fields.',
          items: {
            type: 'object',
            description: 'A single browser operation step with type and type-specific fields',
            properties: {
              type: {
                type: 'string',
                description:
                  'Operation type: goto/click/value/evaluate/wait/screenshot/press/paste/scroll/cookies/getHtml/getText/getTitle/hide/show/viewport/useragent/css'
              },
              url: { type: 'string', description: 'URL for goto step' },
              headers: { type: 'object', description: 'HTTP request headers for goto step' },
              timeout: { type: 'number', description: 'Timeout in milliseconds' },
              selector: {
                type: 'string',
                description: 'CSS selector for click/value/wait/scroll/screenshot steps'
              },
              value: { type: 'string', description: 'Value for value step' },
              script: {
                type: 'string',
                description:
                  'JavaScript function body for evaluate step. Use "return" to get a result. If args are provided, they are accessible as $0, $1, etc.'
              },
              args: {
                type: 'array',
                description: 'Arguments for evaluate function, accessible as $0, $1 in the script',
                items: { type: 'string', description: 'argument value' }
              },
              savePath: { type: 'string', description: 'File save path for screenshot step' },
              key: { type: 'string', description: 'Keyboard key name for press step' },
              modifiers: {
                type: 'array',
                description: 'Modifier keys: ctrl/shift/alt/meta',
                items: { type: 'string', description: 'modifier key' }
              },
              text: { type: 'string', description: 'Text or base64 image for paste step' },
              x: { type: 'number', description: 'X scroll position for scroll step' },
              y: { type: 'number', description: 'Y scroll position for scroll step' },
              ms: { type: 'number', description: 'Milliseconds for wait step' },
              action: { type: 'string', description: 'Cookie action: get/set/remove/clear' },
              name: { type: 'string', description: 'Cookie name' },
              filter: {
                type: 'object',
                description:
                  'Cookie filter: { url?, name?, domain?, path?, secure?, session?, httpOnly? }'
              },
              cookies: {
                type: 'array',
                description: 'Cookies array for set action: [{ name, value }]',
                items: {
                  type: 'object',
                  description: 'cookie item',
                  properties: {
                    name: { type: 'string', description: 'cookie name' },
                    value: { type: 'string', description: 'cookie value' }
                  }
                }
              },
              width: { type: 'number', description: 'Viewport width for viewport step' },
              height: { type: 'number', description: 'Viewport height for viewport/step' },
              userAgent: { type: 'string', description: 'User agent string for useragent step' },
              css: { type: 'string', description: 'CSS to inject for css step' }
            },
            required: ['type']
          }
        },
        options: {
          type: 'object',
          description:
            'Browser window options passed to run(). If options.show is true, the window is shown.',
          properties: {
            show: {
              type: 'boolean',
              description:
                'Show browser window (default false, set to true only if user asks to see the browser)'
            },
            width: { type: 'number', description: 'Window width' },
            height: { type: 'number', description: 'Window height' },
            x: { type: 'number', description: 'Window X position' },
            y: { type: 'number', description: 'Window Y position' },
            center: { type: 'boolean', description: 'Center window' },
            alwaysOnTop: { type: 'boolean', description: 'Keep window always on top' },
            fullscreen: { type: 'boolean', description: 'Open in fullscreen mode' },
            frame: { type: 'boolean', description: 'Show window frame' },
            backgroundColor: { type: 'string', description: 'Window background color' },
            titleBarStyle: {
              type: 'string',
              description: 'Title bar style: default/hidden/hiddenInset/customButtonsOnHover'
            },
            resizable: { type: 'boolean', description: 'Allow window resize' },
            minimizable: { type: 'boolean', description: 'Allow window minimize' },
            maximizable: { type: 'boolean', description: 'Allow window maximize' },
            closable: { type: 'boolean', description: 'Allow window close' },
            skipTaskbar: { type: 'boolean', description: 'Skip taskbar' }
          }
        }
      },
      required: ['steps']
    },
    requireConfirm: true,
    handler: async (...params: unknown[]) => {
      const { steps = [], options } = params[0] as {
        steps: CbStep[]
        options?: Record<string, any>
      }

      const wantsVisible = steps.some((s) => s.type === 'show') || options?.show === true

      let browser = window.preload.inject.cBrowser

      if (!wantsVisible) {
        browser = browser.hide()
      }

      for (const step of steps) {
        browser = applyStep(browser, step)
      }

      return browser.run(options)
    }
  }
]

function applyStep(browser: InjectCBrowser, step: CbStep): InjectCBrowser {
  switch (step.type) {
    case 'goto':
      return browser.goto(step.url, step.headers, step.timeout)
    case 'click':
      return browser.click(step.selector)
    case 'value':
      return browser.value(step.selector, step.value)
    case 'evaluate': {
      const paramNames = (step.args || []).map((_: any, i: number) => `$${i}`)
      const fn = new Function(...paramNames, step.script)
      return browser.evaluate(fn as any, ...(step.args || []))
    }
    case 'wait':
      if (step.selector) return browser.wait(step.selector, step.timeout)
      return browser.wait(step.ms ?? step.timeout ?? 30000)
    case 'screenshot':
      if (step.selector) return browser.screenshot(step.selector, step.savePath)
      return browser.screenshot(step.savePath)
    case 'press':
      return (browser as any).press(step.key, ...(step.modifiers || []))
    case 'paste':
      return browser.paste(step.text)
    case 'scroll':
      if (step.selector) return browser.scroll(step.selector)
      if (step.x !== undefined && step.y !== undefined) return browser.scroll(step.x, step.y)
      if (step.y !== undefined) return browser.scroll(step.y)
      return browser
    case 'cookies':
      return handleCookies(browser, step)
    case 'getHtml':
      return browser.evaluate(function () {
        return document.documentElement.outerHTML
      })
    case 'getText':
      return browser.evaluate(function () {
        return document.body.innerText
      })
    case 'getTitle':
      return browser.evaluate(function () {
        return document.title
      })
    case 'hide':
      return browser.hide()
    case 'show':
      return browser.show()
    case 'viewport':
      return browser.viewport(step.width, step.height)
    case 'useragent':
      return browser.useragent(step.userAgent)
    case 'css':
      return browser.css(step.css)
    default:
      return browser
  }
}

function handleCookies(browser: InjectCBrowser, step: CbStep): InjectCBrowser {
  switch (step.action) {
    case 'get':
      if (step.filter) return browser.cookies(step.filter as any)
      return browser.cookies(step.name)
    case 'set':
      if (step.name && step.value !== undefined)
        return (browser as any).setCookies(step.name, step.value)
      if (step.cookies) return (browser as any).setCookies(step.cookies)
      return browser
    case 'remove':
      return browser.removeCookies(step.name)
    case 'clear':
      return browser.clearCookies(step.url)
    default:
      return browser.cookies()
  }
}

export const nativeBrowserAutomationTools: ToolFunction[] =
  window.preload.inject.getPlatform() === 'utools' ? uBrowserAutomationTools : []
