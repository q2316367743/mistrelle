import { ToolFunction } from '@/domain'

const uBrowserFetchTools: ToolFunction[] = [
  {
    name: 'browser_fetch',
    label: '获取网页内容（浏览器渲染）',
    description: `Fetch the rendered content of a webpage using a HIDDEN browser window. Use this when a plain HTTP request returns empty or incomplete content because the page relies on client-side rendering (JavaScript).

The browser window is always hidden and the operation is read-only: navigate to the URL, wait for rendering, then extract content. No clicking, form filling, cookies, or script injection.

Output modes:
- "markdown" (default): page content converted to markdown, best for reading articles and text
- "text": plain visible text of the page (document.body.innerText)
- "html": raw page HTML (document.documentElement.outerHTML)`,
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to fetch and render' },
        waitMs: {
          type: 'number',
          description:
            'Milliseconds to wait for JavaScript rendering before extracting content. Default 3000. Increase for slow-loading single-page apps.'
        },
        mode: {
          type: 'string',
          description: 'Output format. One of: markdown (default) / text / html'
        }
      },
      required: ['url']
    },
    // 只读 + 强制隐藏窗口 + 无用户可见副作用，视为 safe 无需审批
    risk: 'safe',
    handler: async (...params: unknown[]) => {
      const { url, waitMs = 3000, mode = 'markdown' } = params[0] as {
        url: string
        waitMs?: number
        mode?: 'markdown' | 'text' | 'html'
      }

      let browser = window.preload.inject.cBrowser.hide().goto(url).wait(waitMs)

      if (mode === 'html') {
        browser = browser.evaluate(function () {
          return document.documentElement.outerHTML
        })
      } else if (mode === 'text') {
        browser = browser.evaluate(function () {
          return document.body.innerText
        })
      } else {
        browser = browser.markdown()
      }

      return browser.run()
    }
  }
]

export const browserFetchTools: ToolFunction[] =
  window.preload.inject.getPlatform() === 'utools' ? uBrowserFetchTools : []
