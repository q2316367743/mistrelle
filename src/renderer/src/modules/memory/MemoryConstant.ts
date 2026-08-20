/**
 * 记忆系统常量：长度上限（字符数，中文约 1 字 = 1 token）与时间参数。
 * 上限是硬约束：提示词内约束模型输出，代码层再做兜底保护。
 */

/** 长期记忆（MEMORY.md）最大字符数：提示词约束 + 代码层截断兜底（超限按行丢弃） */
export const MEMORY_MAX_CHARS = 4000

/** 单日短期记忆（memory/YYYY-MM-DD.md）最大字符数，超出时丢弃最旧条目 */
export const DAY_MEMORY_MAX_CHARS = 2000

/** 注入对话时未合并每日文件的累计字符预算（按日期倒序截取） */
export const INJECT_DAY_BUDGET = 4000

/** 提取输入（会话消息转写）的最大字符数，超出保留最新部分 */
export const EXTRACT_INPUT_MAX_CHARS = 30_000

/** 单条消息文本参与转写的最大字符数 */
export const EXTRACT_MESSAGE_MAX_CHARS = 2000

/** 空闲防抖提取延迟：一轮回复结束后等待该时长无新消息再提取 */
export const EXTRACT_DEBOUNCE_MS = 5 * 60 * 1000

/** 本地时区日期串（YYYY-MM-DD），作为每日记忆文件名与合并边界 */
export const toDateKey = (date = new Date()): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 日期串进位到下一天（月末 / 年末由 Date 构造自动进位） */
export const nextDayKey = (dateKey: string): string => {
  const [y, m, d] = dateKey.split('-').map(Number)
  return toDateKey(new Date(y, m - 1, d + 1))
}

/** 本地时区时刻串（HH:mm），标注记忆条目的提取时间 */
export const toTimeKey = (date = new Date()): string =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
