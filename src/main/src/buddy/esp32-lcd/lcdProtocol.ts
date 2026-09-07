/**
 * LCD 心跳行协议 v2 适配层（main 进程，esp32-lcd 域内设备适配）。
 * 协议：`HB,<status>,<seq>,<type>,<pct>,<value>,<unit>,<text>,<ts>`，`,` 分段、`\n` 结尾、
 * 整行 ≤127 字节；字段位置敏感，type 起可省略。规范见固件仓库 docs/protocol.md（v14+ 固件）。
 * 职责：Buddy 事件 → 屏幕 status 映射、快照条目 → 屏显额度（type/pct/value/unit）挑选、
 * 心跳行组装（UTF-8 字节截断与整行长度兜底）。
 */
import type { BuddyEventName } from '@common/types/buddyEvent'
import type { QuotaSnapshot } from '@common/types/quota'

/** 屏幕工作状态（协议 status 列六态） */
export type LcdStatus = 'idle' | 'thinking' | 'ask' | 'permission' | 'done' | 'beat'

/** 屏显额度模板（协议 type 列；不认识板端一律按 codex） */
export type LcdTemplate = 'codex' | 'deepseek'

/**
 * Buddy 事件 → 屏幕状态映射（未收录事件不推送，元数据类噪音不上屏）：
 * 会话创建/空闲收尾 → idle/done；流式输出与命令 → thinking；工具与检索 → ask；
 * 授权类 → permission；授权答复/工具结束 → 回 thinking。
 */
export const LCD_STATUS_BY_EVENT: Partial<Record<BuddyEventName, LcdStatus>> = {
  'session.created': 'idle',
  'session.idle': 'done',
  'session.error': 'idle',
  'message.part.updated': 'thinking',
  'message.updated': 'thinking',
  'tool.execute.before': 'ask',
  'tool.execute.after': 'thinking',
  'permission.asked': 'permission',
  'permission.updated': 'permission',
  'permission.replied': 'thinking',
  'command.executed': 'thinking'
}

/** 事件的屏上文案覆写（其余事件用板端状态默认文案） */
export const LCD_TEXT_BY_EVENT: Partial<Record<BuddyEventName, string>> = {
  'session.error': '会话出错'
}

/** 屏显额度（心跳行 type/pct/value/unit 四列来源） */
export interface LcdScreenQuota {
  template: LcdTemplate
  pct?: number
  value: string
  unit: string
}

/** 从快照取屏显额度：优先主额度条目（quota 配置 screen 指定），无则 null=屏显额度缺省 */
export function pickScreenQuota(snapshot: QuotaSnapshot | null): LcdScreenQuota | null {
  const main = snapshot?.main
  if (!main?.screenTemplate || !main.screenValue) return null
  return {
    template: main.screenTemplate,
    pct: main.screenPct,
    value: main.screenValue,
    unit: main.screenUnit ?? ''
  }
}

const MAX_LINE_BYTES = 127
const MAX_UNIT_BYTES = 7
const MAX_TEXT_BYTES = 23

const utf8Bytes = (text: string): number => new TextEncoder().encode(text).length

/** 按字节截断 UTF-8 文本（不切半个多字节字符） */
function truncateUtf8(text: string, maxBytes: number): string {
  if (utf8Bytes(text) <= maxBytes) return text
  let out = ''
  for (const char of text) {
    if (utf8Bytes(out + char) > maxBytes) break
    out += char
  }
  return out
}

/** 组装一条心跳行：status+seq 必填，额度/文案可选（省略取板端默认）；自动截断并保证 ≤127 字节 */
export function buildHeartbeatLine(options: {
  status: LcdStatus
  seq: number
  quota?: LcdScreenQuota | null
  text?: string
}): string {
  const { status, seq, quota, text } = options
  const pct = quota?.pct
  const value =
    typeof quota?.value === 'string' && /^[0-9.]{1,15}$/.test(quota.value) ? quota.value : ''
  const head = ['HB', status, String(seq)]
  const tail = [
    quota?.template ?? 'codex',
    typeof pct === 'number' ? String(Math.min(100, Math.max(0, Math.round(pct)))) : '100',
    value,
    truncateUtf8(quota?.unit ?? '', MAX_UNIT_BYTES),
    truncateUtf8(text ?? '', MAX_TEXT_BYTES),
    '0'
  ]
  const line = [...head, ...tail].join(',')
  // 整行长度兜底（板端行缓冲 128B，超长整行丢弃）：先丢文案再丢单位
  if (utf8Bytes(line) > MAX_LINE_BYTES) {
    const withoutText = [...head, ...tail.slice(0, 4), ''].join(',')
    if (utf8Bytes(withoutText) <= MAX_LINE_BYTES) return withoutText
    return [...head, ...tail.slice(0, 3), '', ''].join(',')
  }
  return line
}
