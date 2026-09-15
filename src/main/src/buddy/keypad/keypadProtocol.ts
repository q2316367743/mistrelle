/**
 * 小键盘协议解析（main 进程）：设备上报 `<控件id>,<信号>[,<幅度两位>]`
 * （如 `1,on`、`1,off`、`10,left`、`10,left,23`），**不带任何行尾/分隔符**，
 * 不能按 \n 分帧。这里在字节流上按文法滑动匹配：完整消息即发事件；
 * 不完整前缀等待更多数据；失步（乱码/波特率不符）丢字符重同步。
 *
 * **幅度必须定长两位**（00–99）：设备无分隔符，可变长数字会与下一条消息的控件号粘连
 * （`10,left,23` 紧跟上 `10,right` 会被读成幅度 2310）——两位宽度让切分位置唯一，
 * 解析器无需终止符即可确定边界。设备侧未按两位补零时该条幅度会解析错误（随后自恢复）。
 *
 * 兼容：老固件的 `1,on` / `1,off` 仍是合法消息（幅度段可选），无需固件同步升级。
 * 兼容恰有 \r\n / 空白分隔的设备，信号词大小写宽容。
 */
import { isKeypadSignal, KEYPAD_SIGNALS, type KeypadSignal } from '@common/types/keypad'

/** 解析出的信号事件 */
export interface KeypadSignalEvent {
  controlId: string
  signal: KeypadSignal
  /** 转动幅度百分比（0–99；仅设备上报了幅度段时存在） */
  value?: number
}

/** 信号词表（从 KeypadSignalOptions 派生，新增信号自动生效） */
const SIGNAL_PATTERN = KEYPAD_SIGNALS.join('|')

/** 完整消息（头部锚定，信号大小写宽容；幅度段可选且恰为两位） */
const MESSAGE_RE = new RegExp(`^(\\d+),(${SIGNAL_PATTERN})(?:,(\\d{2}))?`, 'i')

/** 信号词前缀判定（大小写宽容） */
function isSignalPrefix(value: string): boolean {
  const lower = value.toLowerCase()
  return KEYPAD_SIGNALS.some((signal) => signal.startsWith(lower))
}

/**
 * 当前缓冲是否仍可能补全为一条合法消息（是则等待更多数据，不丢字符）。
 * 按 `,` 分段校验：控件号（纯数字）→ 信号词（须为某信号的前缀）→ 幅度（两位定长，未满则等）。
 */
function isIncompleteMessage(buffer: string): boolean {
  const segments = buffer.split(',')
  if (!/^\d+$/.test(segments[0])) return false
  if (segments.length === 1) return true
  if (segments.length > 3) return false
  const signal = segments[1]
  if (signal === '') return true
  if (!isSignalPrefix(signal)) return false
  if (segments.length === 2) return true
  return /^\d{0,2}$/.test(segments[2])
}

/**
 * 创建流式解析器：把收到的原始文本块喂给返回的函数，
 * 每解析出一条完整消息回调一次 onEvent（跨 chunk 的残段由闭包内缓冲衔接）。
 */
export function createKeypadParser(
  onEvent: (event: KeypadSignalEvent) => void
): (chunk: string) => void {
  let buffer = ''
  return (chunk: string) => {
    buffer += chunk
    for (;;) {
      buffer = buffer.replace(/^[\s\r\n]+/, '')
      const matched = MESSAGE_RE.exec(buffer)
      if (matched) {
        buffer = buffer.slice(matched[0].length)
        const signal = matched[2].toLowerCase()
        if (!isKeypadSignal(signal)) continue
        const event: KeypadSignalEvent = { controlId: matched[1], signal }
        // 幅度段恰为两位（正则保证 00–99），仅转动信号消费
        if (matched[3] != null) event.value = Number.parseInt(matched[3], 10)
        onEvent(event)
        continue
      }
      if (buffer === '' || isIncompleteMessage(buffer)) return
      buffer = buffer.slice(1)
    }
  }
}
