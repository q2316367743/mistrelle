import type { AIMessage, ChatMessage, UserMessage } from '@/domain'
import {
  aiChatContentGet,
  aiChatContentStamp,
  aiChatGetItem,
  aiChatList,
  buildChatMainKey,
  chatIdFromKey
} from '@/windows/main/modules/chat/service/ChatService'
import { useLog } from '@/hooks/UseLog'
import {
  EXTRACT_DEBOUNCE_MS,
  EXTRACT_INPUT_MAX_CHARS,
  EXTRACT_MESSAGE_MAX_CHARS,
  toDateKey,
  toTimeKey
} from './MemoryConstant'
import { MEMORY_EXTRACT_PROMPT } from './MemoryPrompt'
import {
  appendDayMemory,
  memoryChatCompletion,
  readSoulState,
  setExtractedProgress
} from './MemoryService'

const logger = useLog({ name: 'modules:memory-extractor' })

/** 单次提取的结果：ok=false 表示失败或被跳过（进度未推进，下次应重试） */
export interface ExtractResult {
  ok: boolean
  /** 本次是否消费到新消息（无论是否产出条目） */
  hadNew: boolean
  /** 写入当日记忆的条目数 */
  entries: number
}

const clip = (text: string): string =>
  text.length > EXTRACT_MESSAGE_MAX_CHARS ? `${text.slice(0, EXTRACT_MESSAGE_MAX_CHARS)}…` : text

/** 单条用户消息 → 紧凑文本（正文 + 引用标识） */
const flattenUserMessage = (message: UserMessage): string => {
  const parts: string[] = []
  for (const content of message.content) {
    if (content.type === 'text') parts.push(clip(content.data))
    else if (content.type === 'attachment')
      parts.push(`[附件:${content.data.map((a) => a.name ?? '').filter(Boolean).join('、')}]`)
    else if (content.type === 'skill') parts.push(`[技能:${content.data.name}]`)
    else if (content.type === 'tool') parts.push(`[工具:${content.data.label}]`)
  }
  return parts.join(' ')
}

/** 单条助手消息 → 紧凑文本（正文 + 工具调用名，跳过思考 / 活动 / 建议等中间态） */
const flattenAssistantMessage = (message: AIMessage): string => {
  const parts: string[] = []
  for (const content of message.content ?? []) {
    if (content.type === 'text' || content.type === 'markdown') parts.push(clip(content.data))
    else if (content.type === 'toolcall') parts.push(`[调用工具:${content.data.toolCallName}]`)
  }
  return parts.join(' ')
}

/**
 * 消息列表 → LLM 提取用的紧凑转写。只保留 user / assistant 的文本与关键标识，
 * 总长超限时保留最新部分（最新对话的信息密度最高）。
 */
export const flattenMessages = (messages: ChatMessage[]): string => {
  const lines: string[] = []
  for (const message of messages) {
    if (message.role === 'user') {
      const text = flattenUserMessage(message)
      if (text) lines.push(`[用户] ${text}`)
    } else if (message.role === 'assistant') {
      const text = flattenAssistantMessage(message)
      if (text) lines.push(`[助手] ${text}`)
    }
  }
  let transcript = lines.join('\n')
  if (transcript.length > EXTRACT_INPUT_MAX_CHARS) {
    transcript = `（更早内容已省略）\n${transcript.slice(-EXTRACT_INPUT_MAX_CHARS)}`
  }
  return transcript
}

/** 提取中的会话（防并发重复提取） */
const inFlight = new Set<string>()

/**
 * 对单个会话做一次增量提取：读取自上次提取点之后的新消息 → LLM 提取值得记住的条目 →
 * 追加到当日短期记忆。无可提取内容、模型判定无可记（[NONE]）时不写入条目，
 * 但成功消费后即推进进度；失败不推进，下次重试。
 */
export const extractSession = async (storageKey: string): Promise<ExtractResult> => {
  const state = await readSoulState()
  if (!state.memoryEnabled) return { ok: true, hadNew: false, entries: 0 }
  if (inFlight.has(storageKey)) return { ok: false, hadNew: false, entries: 0 }
  const content = await aiChatContentGet(storageKey)
  if (!content) return { ok: true, hadNew: false, entries: 0 }
  const from = state.extracted[storageKey] ?? 0
  const messages = content.messages
  if (messages.length <= from) return { ok: true, hadNew: false, entries: 0 }

  // 隐私聊天：不提取任何内容，直接推进进度（防止之后关闭隐私时这段消息被补提进记忆）
  const chatId = chatIdFromKey(storageKey)
  if (chatId && (await aiChatGetItem(chatId))?.privacy) {
    await setExtractedProgress(storageKey, messages.length)
    return { ok: true, hadNew: false, entries: 0 }
  }

  const transcript = flattenMessages(messages.slice(from))
  inFlight.add(storageKey)
  try {
    let entries = 0
    if (transcript) {
      const output = await memoryChatCompletion(MEMORY_EXTRACT_PROMPT, transcript)
      const lines = output
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('- '))
        .map((line) => `- [${toTimeKey()}] ${line.slice(2)}`)
      if (lines.length > 0) {
        await appendDayMemory(toDateKey(), lines)
        entries = lines.length
        logger.info(`已提取 ${entries} 条记忆条目（会话 ${storageKey}）`)
      }
    }
    // 无论是否产出条目，已消费的消息不再重复提取
    await setExtractedProgress(storageKey, messages.length)
    return { ok: true, hadNew: true, entries }
  } catch (e) {
    logger.error(`提取会话记忆失败（${storageKey}），下次将重试`, e)
    return { ok: false, hadNew: true, entries: 0 }
  } finally {
    inFlight.delete(storageKey)
  }
}

/** 空闲防抖定时器：每轮回复结束 / 会话状态变化时重置，静止超时后提取 */
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** 安排空闲防抖提取：延迟内会话再次活动则自动顺延 */
export const scheduleExtraction = (storageKey: string): void => {
  const existing = debounceTimers.get(storageKey)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    debounceTimers.delete(storageKey)
    void extractSession(storageKey)
  }, EXTRACT_DEBOUNCE_MS)
  debounceTimers.set(storageKey, timer)
}

/** 立即提取（取消防抖）：会话空闲回收 / 退出前尽力而为 */
export const extractSessionNow = (storageKey: string): void => {
  const existing = debounceTimers.get(storageKey)
  if (existing) {
    clearTimeout(existing)
    debounceTimers.delete(storageKey)
  }
  void extractSession(storageKey)
}

/** 扫描去重缓存：storageKey（chat:{id}）→ 上次成功消费时的 updated_time（未变则跳过解析） */
const scannedStamp = new Map<string, number>()

export interface PendingExtractSummary {
  /** 消费到新消息的会话数 */
  sessions: number
  /** 写入当日记忆的条目总数 */
  entries: number
}

/**
 * 扫描提取所有未提取完的会话：
 * - 合并前的兜底补提（覆盖 app 退出时丢掉的防抖尾段、此前提取失败的会话）
 * - 设置页「立即提取」手动触发
 * 以「最后合并日」为时间下界预筛（chat_content.updated_time），成功消费后记录戳去重，重复调用开销极小。
 */
export const extractPendingSessions = async (): Promise<PendingExtractSummary> => {
  const state = await readSoulState()
  const summary: PendingExtractSummary = { sessions: 0, entries: 0 }
  if (!state.memoryEnabled || !state.lastConsolidateDate) return summary
  const cutoff = new Date(`${state.lastConsolidateDate}T00:00:00`).getTime()
  const list = await aiChatList()
  for (const item of list) {
    const key = buildChatMainKey(item.id)
    const stamp = await aiChatContentStamp(key)
    if (stamp === null || stamp < cutoff || scannedStamp.get(key) === stamp) continue
    const result = await extractSession(key)
    if (!result.ok) continue
    scannedStamp.set(key, stamp)
    if (result.hadNew) {
      summary.sessions += 1
      summary.entries += result.entries
    }
  }
  return summary
}
