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
- "html": raw page HTML (document.documentElement.outerHTML)

Selector targeting: optionally pass a CSS selector to extract only a specific block (e.g. "article", "#main") instead of the whole page, which saves context tokens for large pages. Use it when the page is large and you already know the target element. If the selector matches nothing, an error is returned so you can retry with a corrected selector or omit it for the full page.`,
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
        },
        selector: {
          type: 'string',
          description:
            'CSS selector to extract only the matching element (e.g. "article", ".content"). Optional; omit it to get the whole page. An error is returned when nothing matches.'
        }
      },
      required: ['url']
    },
    // 只读 + 强制隐藏窗口 + 无用户可见副作用，视为 safe 无需审批
    risk: 'safe',
    handler: async (...params: unknown[]) => {
      const { url, waitMs = 3000, mode = 'markdown', selector } = params[0] as {
        url: string
        waitMs?: number
        mode?: 'markdown' | 'text' | 'html'
        selector?: string
      }

      let browser = window.preload.inject.cBrowser.hide().goto(url).wait(waitMs)

      if (mode === 'html') {
        browser = browser.evaluate(extractHtml, selector)
      } else if (mode === 'text') {
        browser = browser.evaluate(extractText, selector)
      } else {
        browser = browser.markdown(selector)
      }

      return browser.run()
    }
  }
]

function extractHtml(sel?: string): string {
  if (sel) {
    const el = document.querySelector(sel)
    if (!el) throw new Error(`CSS 选择器 "${sel}" 未匹配到任何元素`)
    return el.outerHTML
  }
  return document.documentElement.outerHTML
}

function extractText(sel?: string): string {
  if (sel) {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) throw new Error(`CSS 选择器 "${sel}" 未匹配到任何元素`)
    return el.innerText
  }
  return document.body.innerText
}

export const browserFetchTools: ToolFunction[] =
  window.preload.inject.getPlatform() === 'utools' ? uBrowserFetchTools : []
