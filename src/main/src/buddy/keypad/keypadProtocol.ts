/**
 * 小键盘协议解析（main 进程）：设备上报 `<键位>,<动作>`（如 `1,on`、`2,off`），
 * **不带任何行尾/分隔符**，不能按 \n 分帧。这里在字节流上按文法「数字 + , + on/off」
 * 滑动匹配：完整消息即发事件；不完整前缀等待更多数据；失步（乱码/波特率不符）丢字符重同步。
 * 兼容恰有 \r\n / 空白分隔的设备，动作大小写宽容。
 */
import { isKeypadKeyAction, type KeypadKeyAction } from '@common/types/keypad'

/** 解析出的按键事件 */
export interface KeypadKeyEvent {
  keyId: string
  action: KeypadKeyAction
}

/** 完整消息（头部锚定，动作大小写宽容） */
const MESSAGE_RE = /^(\d+),(on|off)/i

/** 仍可能补全为合法消息的前缀（等待更多数据，不丢字符）：数字、或数字, + o/on/f/of 残段 */
const PREFIX_RE = /^\d+(,(?:o(?:n|f(?:f)?)?)?)?$/

/**
 * 创建流式解析器：把收到的原始文本块喂给返回的函数，
 * 每解析出一条完整消息回调一次 onEvent（跨 chunk 的残段由闭包内缓冲衔接）。
 */
export function createKeypadParser(
  onEvent: (event: KeypadKeyEvent) => void
): (chunk: string) => void {
  let buffer = ''
  return (chunk: string) => {
    buffer += chunk
    for (;;) {
      buffer = buffer.replace(/^[\s\r\n]+/, '')
      const matched = MESSAGE_RE.exec(buffer)
      if (matched) {
        buffer = buffer.slice(matched[0].length)
        const action = matched[2].toLowerCase()
        if (isKeypadKeyAction(action)) onEvent({ keyId: matched[1], action })
        continue
      }
      if (buffer === '' || PREFIX_RE.test(buffer)) return
      buffer = buffer.slice(1)
    }
  }
}
