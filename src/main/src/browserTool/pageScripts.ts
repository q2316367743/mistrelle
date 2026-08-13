/**
 * browserTool 页内执行函数（main）：经 `String(fn)` 序列化后在**目标页面上下文**中执行。
 *
 * 约束：函数必须**自包含**（只引用 document / window 等页面全局，不引用模块作用域变量），
 * 否则序列化后送入页面会引用不存在的作用域。
 */

/** 将页内函数序列化为可执行代码：`(fn)(args...)` */
export const callCode = (fn: Function, ...args: unknown[]): string =>
  `(${String(fn)})(${args.map((a) => JSON.stringify(a)).join(',')})`

/** 提取元素 outerHTML 或整页 HTML（selector 未命中抛错） */
export const extractHtml = (sel?: string): string => {
  if (sel) {
    const el = document.querySelector(sel)
    if (!el) throw new Error(`CSS 选择器 "${sel}" 未匹配到任何元素`)
    return el.outerHTML
  }
  return document.documentElement.outerHTML
}

/** 提取元素 innerText 或整页文本 */
export const extractText = (sel?: string): string => {
  if (sel) {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) throw new Error(`CSS 选择器 "${sel}" 未匹配到任何元素`)
    return el.innerText
  }
  return document.body.innerText
}

/** 在元素中心分发 click 事件（JS 事件分发） */
export const dispatchClick = (selector: string): void => {
  if (document.activeElement) {
    ;(document.activeElement as HTMLElement).blur()
  }
  const el = document.querySelector(selector)
  if (!el) throw new Error(`click: unable to find element by selector "${selector}"`)
  const rect = el.getBoundingClientRect()
  el.dispatchEvent(
    new window.MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    })
  )
}

/** 设置表单值并触发 input/change 事件 */
export const setValue = (selector: string, value: string): void => {
  const el = document.querySelector(selector)
  if (!el) throw new Error(`value: unable to find element by selector "${selector}"`)
  ;(el as HTMLInputElement).value = value
  if (
    el.tagName === 'TEXTAREA' ||
    (el.tagName === 'INPUT' && ['text', 'password', 'search'].includes((el as HTMLInputElement).type))
  ) {
    el.dispatchEvent(new window.Event('input', { bubbles: true, cancelable: true }))
  } else {
    el.dispatchEvent(new window.Event('change', { bubbles: true, cancelable: true }))
  }
}

/** 垂直滚动到 y */
export const scrollToY = (y: number): void => {
  window.scrollTo(window.scrollX, y)
}

/** 滚动到 (x, y) */
export const scrollToXY = (x: number, y: number): void => {
  window.scrollTo(x, y)
}

/** 滚动到元素位置 */
export const scrollToElement = (selector: string): void => {
  const el = document.querySelector(selector)
  if (!el) throw new Error(`scroll: unable to find element by selector "${selector}"`)
  const rect = el.getBoundingClientRect()
  window.scrollTo(rect.left, rect.top)
}

/** wait(selector) 轮询条件代码 */
export const waitForSelectorCode = (selector: string): string =>
  `!!document.querySelector(${JSON.stringify(selector)})`
