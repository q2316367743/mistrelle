/**
 * 「打开网页」动作定义：http/https 网址（main 侧 shell.openExternal 交系统默认浏览器打开）。
 * 仅接受 http/https 协议（防 file:/javascript: 等非网页协议误配），执行侧不再二次校验。
 */
import type { KeypadUrlAction } from '../../types/keypad'
import type { KeypadActionDefinition } from './index'

/** 网址合法性：trim 非空 + http/https 协议前缀 */
export function isValidKeypadUrl(url: string): boolean {
  return /^https?:\/\/\S+/i.test(url)
}

export const urlAction: KeypadActionDefinition<KeypadUrlAction> = {
  type: 'url',
  label: '打开网页',
  normalize(raw) {
    if (typeof raw.url !== 'string') return null
    const url = raw.url.trim()
    if (!isValidKeypadUrl(url)) return null
    return { type: 'url', url }
  },
  createDefault() {
    return { type: 'url', url: '' }
  }
}
