/**
 * 系统级模拟按键（main 进程）：koffi 预编译 FFI 直调平台 API，跨平台无需本地编译链。
 * - macOS：CoreGraphics CGEventCreateKeyboardEvent + CGEventPost（修饰键发独立按下/抬起事件，
 *   主键事件额外携带修饰 flag 掩码）；模拟按键需系统「辅助功能」授权，经 AXIsProcessTrusted 检测。
 * - Windows：user32 keybd_event 逐键 down/up（KEYEVENTF_KEYUP=2），无需授权。
 * 组合按下/释放带引用计数：同一组合被多个键位绑定时全部释放才真正抬起；
 * 断开/拔线/退出经 releaseAll 兜底，防修饰键卡死。
 */
import koffi from 'koffi'
import type { KeypadComboAction, KeypadKeyName, KeypadModifier } from '@common/types/keypad'

/** macOS 虚拟键码（kVK_ANSI_* / kVK_F*，Apple Events.h） */
const MAC_KEY_CODES: Record<KeypadKeyName, number> = {
  enter: 0x4c,
  f1: 0x7a, f2: 0x78, f3: 0x63, f4: 0x76, f5: 0x60, f6: 0x61, f7: 0x62,
  f8: 0x64, f9: 0x65, f10: 0x6d, f11: 0x67, f12: 0x6f, f13: 0x69, f14: 0x6b,
  f15: 0x71, f16: 0x6a, f17: 0x40, f18: 0x4f, f19: 0x50,
  a: 0x00, b: 0x0b, c: 0x08, d: 0x02, e: 0x0e, f: 0x03, g: 0x05, h: 0x04,
  i: 0x22, j: 0x26, k: 0x28, l: 0x25, m: 0x2e, n: 0x2d, o: 0x1f, p: 0x23,
  q: 0x0c, r: 0x0f, s: 0x01, t: 0x11, u: 0x20, v: 0x09, w: 0x0d, x: 0x07,
  y: 0x10, z: 0x06,
  '0': 0x1d, '1': 0x12, '2': 0x13, '3': 0x14, '4': 0x15, '5': 0x17,
  '6': 0x16, '7': 0x1a, '8': 0x1c, '9': 0x19
}

/** macOS 修饰键（kVK_* 键码 + CGEvent flag 掩码） */
const MAC_MODIFIERS: Record<KeypadModifier, { code: number; flag: number }> = {
  shift: { code: 0x38, flag: 1 << 17 },
  ctrl: { code: 0x3b, flag: 1 << 18 },
  alt: { code: 0x3a, flag: 1 << 19 },
  meta: { code: 0x37, flag: 1 << 20 }
}

/** Windows 修饰键虚拟键码（VK_SHIFT / VK_CONTROL / VK_MENU / VK_LWIN） */
const WIN_MODIFIER_CODES: Record<KeypadModifier, number> = {
  shift: 0x10, ctrl: 0x11, alt: 0x12, meta: 0x5b
}

/** Windows 主键虚拟键码：Enter 0x0D、字母 0x41+、数字 0x30+、F 键 0x70+(n-1) */
function winKeyCode(name: KeypadKeyName): number {
  if (name === 'enter') return 0x0d
  const first = name.charCodeAt(0)
  if (first >= 97 && first <= 122) return 0x41 + first - 97
  if (first >= 48 && first <= 57) return 0x30 + first - 48
  return 0x70 + Number(name.slice(1)) - 1
}

/** 平台按键投递器（macOS flags 为 CGEvent 修饰掩码；Windows 忽略 flags，修饰键走独立事件） */
interface KeyPoster {
  post(code: number, down: boolean, flags: number): void
}

let poster: KeyPoster | null = null

function loadPoster(): KeyPoster {
  if (poster) return poster
  if (process.platform === 'darwin') {
    const cg = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
    const cf = koffi.load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
    const createEvent = cg.func('CGEventCreateKeyboardEvent', 'void *', ['void *', 'uint32', 'bool'])
    const setFlags = cg.func('CGEventSetFlags', 'void', ['void *', 'uint64'])
    const postEvent = cg.func('CGEventPost', 'void', ['uint32', 'void *'])
    const release = cf.func('CFRelease', 'void', ['void *'])
    poster = {
      post(code, down, flags) {
        // kCGHIDEventTap=0：投递到会话 HID 层，前台应用与系统快捷键均可收到
        const event = createEvent(null, code, down)
        if (!event) return
        if (flags) setFlags(event, flags)
        postEvent(0, event)
        release(event)
      }
    }
  } else {
    const user32 = koffi.load('user32.dll')
    const keybdEvent = user32.func('keybd_event', 'void', ['uint8', 'uint8', 'uint32', 'uintptr'])
    poster = {
      post(code, down) {
        keybdEvent(code, 0, down ? 0 : 2, 0)
      }
    }
  }
  return poster
}

/** 当前按住中的组合（id → 绑定 + 引用计数），防同组合多键位场景下提前抬起 */
const heldCombos = new Map<string, { binding: KeypadComboAction; count: number }>()

function comboId(binding: KeypadComboAction): string {
  return `${[...binding.modifiers].sort().join('+')}|${binding.key}`
}

/** 投递一次组合的按下/抬起：修饰键先下后上（逆序），主键事件在 macOS 带修饰 flag */
function postCombo(binding: KeypadComboAction, down: boolean): void {
  const mac = process.platform === 'darwin'
  const post = loadPoster().post
  let flags = 0
  for (const mod of binding.modifiers) {
    if (mac) {
      flags |= MAC_MODIFIERS[mod].flag
      post(MAC_MODIFIERS[mod].code, down, down ? MAC_MODIFIERS[mod].flag : 0)
    } else {
      post(WIN_MODIFIER_CODES[mod], down, 0)
    }
  }
  const code = mac ? MAC_KEY_CODES[binding.key] : winKeyCode(binding.key)
  post(code, down, mac && down ? flags : 0)
}

/** 组合按下（引用计数 >1 时不再重复投递） */
export function pressCombo(binding: KeypadComboAction): void {
  const id = comboId(binding)
  const held = heldCombos.get(id)
  if (held) {
    held.count += 1
    return
  }
  heldCombos.set(id, { binding, count: 1 })
  postCombo(binding, true)
}

/** 组合释放（计数归零才投递；未按住时幂等跳过） */
export function releaseCombo(binding: KeypadComboAction): void {
  const id = comboId(binding)
  const held = heldCombos.get(id)
  if (!held) return
  held.count -= 1
  if (held.count > 0) return
  heldCombos.delete(id)
  postCombo(binding, false)
}

/** 释放所有按住中的组合（断开/拔线/退出兜底，防修饰键卡死） */
export function releaseAll(): void {
  for (const { binding } of heldCombos.values()) postCombo(binding, false)
  heldCombos.clear()
}

let axIsProcessTrusted: (() => boolean) | null = null

/** 系统级模拟按键权限是否就绪（macOS 辅助功能授权检测；Windows 恒 true） */
export function isAccessibilityGranted(): boolean {
  if (process.platform !== 'darwin') return true
  if (!axIsProcessTrusted) {
    const appServices = koffi.load(
      '/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices'
    )
    axIsProcessTrusted = appServices.func('AXIsProcessTrusted', 'bool', [])
  }
  return axIsProcessTrusted()
}
