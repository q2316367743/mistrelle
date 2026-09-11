/**
 * 快捷键录制（页面级 keydown 捕获，模块级单例）：全局同时仅一处录制，新录制顶掉旧录制
 * （旧录制只收到 onSettled 做 UI 复位，不会误触发 onPick）。Esc/失焦取消；
 * 纯修饰键继续等待；event.code 映射白名单主键后回调（一次按键即结束录制）。
 * 系统/菜单保留组合（如 macOS Cmd+Q）被先行消费录不到，属预期。
 */
import {
  isKeypadRegularKeyName,
  type KeypadRegularKeyName,
  type KeypadModifier
} from '@common/types/keypad'

const MODIFIER_ONLY_KEYS = ['Control', 'Shift', 'Alt', 'Meta']

/** 录到的组合键（修饰键 flags + 白名单普通主键；媒体键无法录制，只能从下拉选择） */
export interface ComboRecord {
  modifiers: KeypadModifier[]
  key: KeypadRegularKeyName
}

export interface ComboRecorderHandlers {
  /** 录到组合键（录制自然结束） */
  onPick: (record: ComboRecord) => void
  /** 录制结束（取消/被顶掉/录到），组件用于复位录制态 UI */
  onSettled: () => void
}

let active: (() => void) | null = null

/** 开始录制（自动顶掉进行中的旧录制） */
export function startComboRecording(handlers: ComboRecorderHandlers): void {
  stopComboRecording()
  const stop = (): void => {
    window.removeEventListener('keydown', onKeydown, true)
    window.removeEventListener('blur', stop)
    if (active === stop) active = null
    handlers.onSettled()
  }
  const onKeydown = (e: KeyboardEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') {
      stop()
      return
    }
    if (MODIFIER_ONLY_KEYS.includes(e.key)) return
    const key = codeToKeyName(e.code)
    if (!key) return
    stop()
    const modifiers: KeypadModifier[] = []
    if (e.ctrlKey) modifiers.push('ctrl')
    if (e.altKey) modifiers.push('alt')
    if (e.shiftKey) modifiers.push('shift')
    if (e.metaKey) modifiers.push('meta')
    handlers.onPick({ modifiers, key })
  }
  // capture 阶段监听，先于页面其他快捷处理拿到按键
  window.addEventListener('keydown', onKeydown, true)
  window.addEventListener('blur', stop)
  active = stop
}

/** 结束当前录制（无录制时无副作用） */
export function stopComboRecording(): void {
  active?.()
}

/** event.code → 白名单普通主键名（Enter/字母/数字/F 键；媒体键与其他键不支持，忽略继续等待） */
function codeToKeyName(code: string): KeypadRegularKeyName | null {
  let name = ''
  if (code === 'Enter') name = 'enter'
  else if (/^Key[A-Z]$/.test(code)) name = code.slice(3).toLowerCase()
  else if (/^Digit[0-9]$/.test(code)) name = code.slice(5)
  else if (/^F([1-9]|1[0-9])$/.test(code)) name = code.toLowerCase()
  else return null
  return isKeypadRegularKeyName(name) ? name : null
}
