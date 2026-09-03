/**
 * 键盘键码映射（browserTool）：DOM 键名 → Electron sendInputEvent keyCode。
 */

const KEY_CODE_MAP: Record<string, string> = {
  Backspace: 'Backspace',
  Tab: 'Tab',
  Enter: 'Enter',
  MediaPlayPause: 'MediaPlayPause',
  Escape: 'Escape',
  Space: 'Space',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  End: 'End',
  Home: 'Home',
  ArrowLeft: 'Left',
  ArrowUp: 'Up',
  ArrowRight: 'Right',
  ArrowDown: 'Down',
  PrintScreen: 'PrintScreen',
  Insert: 'Insert',
  Delete: 'Delete',
  Digit0: '0',
  Digit1: '1',
  Digit2: '2',
  Digit3: '3',
  Digit4: '4',
  Digit5: '5',
  Digit6: '6',
  Digit7: '7',
  Digit8: '8',
  Digit9: '9',
  KeyA: 'A',
  KeyB: 'B',
  KeyC: 'C',
  KeyD: 'D',
  KeyE: 'E',
  KeyF: 'F',
  KeyG: 'G',
  KeyH: 'H',
  KeyI: 'I',
  KeyJ: 'J',
  KeyK: 'K',
  KeyL: 'L',
  KeyM: 'M',
  KeyN: 'N',
  KeyO: 'O',
  KeyP: 'P',
  KeyQ: 'Q',
  KeyR: 'R',
  KeyS: 'S',
  KeyT: 'T',
  KeyU: 'U',
  KeyV: 'V',
  KeyW: 'W',
  KeyX: 'X',
  KeyY: 'Y',
  KeyZ: 'Z',
  F1: 'F1',
  F2: 'F2',
  F3: 'F3',
  F4: 'F4',
  F5: 'F5',
  F6: 'F6',
  F7: 'F7',
  F8: 'F8',
  F9: 'F9',
  F10: 'F10',
  F11: 'F11',
  F12: 'F12',
  Semicolon: ';',
  Equal: '=',
  Comma: ',',
  Minus: '-',
  Period: '.',
  Slash: '/',
  Backquote: '`',
  BracketLeft: '[',
  Backslash: '\\',
  BracketRight: ']',
  Quote: "'"
}

/** 缓存的键码值数组（延迟初始化） */
let keyCodeValues: string[] | null = null

/**
 * 将 DOM 键名解析为 Electron keyCode
 *
 * Enter → 回车字符（13），Space → 空格字符（32）；无法映射返回 null。
 */
export function resolveKeyCode(key: string): string | null {
  if (!keyCodeValues) keyCodeValues = Object.values(KEY_CODE_MAP)
  const keyStr = String(key).toLowerCase()
  let keyCode = keyCodeValues.find((k) => k.toLowerCase() === keyStr)
  if (!keyCode) return null
  if (keyCode === 'Enter') keyCode = String.fromCharCode(13)
  else if (keyCode === 'Space') keyCode = String.fromCharCode(32)
  return keyCode
}
