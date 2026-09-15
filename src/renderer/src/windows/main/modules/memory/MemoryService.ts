import { useSettingAiStore, useSettingDefaultStore } from '@/windows/main/store'
import { createChatCompletion } from '@/windows/main/modules/ai'
import { readJsonFile, writeJsonFile } from '@/utils/native'
import {
  getSoulMemoryBackupPath,
  getSoulMemoryDir,
  getSoulMemoryDayPath,
  getSoulMemoryPath,
  getSoulStatePath
} from '@/global/Constant'
import { DAY_MEMORY_MAX_CHARS, INJECT_DAY_BUDGET, toDateKey } from './MemoryConstant'

/** 记忆系统状态（soul/state.json）：开关、合并边界、各会话提取进度 */
export interface SoulState {
  memoryEnabled: boolean
  /** 下一个待消费日期（YYYY-MM-DD，含边界）；每日文件仅消费「日期 >= 该值 且 < 今天」的 */
  lastConsolidateDate: string
  /** 上次成功合并长期记忆的时间（ISO 8601）；存量 state.json 无该字段 */
  lastConsolidatedAt?: string
  /** storageKey（会话消息文件路径）→ 已提取的消息数量 */
  extracted: Record<string, number>
}

let stateCache: SoulState | undefined

const persistState = async (): Promise<void> => {
  if (!stateCache) return
  await ensureSoulDirs()
  await writeJsonFile(getSoulStatePath(), stateCache)
}

/**
 * 读取记忆状态（进程内缓存）。
 * 首次初始化时合并基线定为今天：不回溯提取历史会话，记忆从启用日开始积累，
 * 启用当天的每日文件自次日起可被合并消费。
 */
export const readSoulState = async (): Promise<SoulState> => {
  if (stateCache) return stateCache
  const loaded = await readJsonFile<SoulState>(getSoulStatePath())
  if (loaded) {
    stateCache = loaded
  } else {
    stateCache = { memoryEnabled: true, lastConsolidateDate: toDateKey(), extracted: {} }
    await persistState()
  }
  return stateCache
}

/** 修改记忆状态并落盘（直接变更 readSoulState 返回的对象后调用亦可） */
export const writeSoulState = async (): Promise<void> => {
  await persistState()
}

/** 更新会话提取进度并落盘 */
export const setExtractedProgress = async (storageKey: string, count: number): Promise<void> => {
  const state = await readSoulState()
  state.extracted[storageKey] = count
  await persistState()
}

/** 切换记忆系统开关（设置页）：关闭后提取 / 合并 / 注入全部停止 */
export const setMemoryEnabled = async (enabled: boolean): Promise<void> => {
  const state = await readSoulState()
  state.memoryEnabled = enabled
  await persistState()
  invalidateMemoryPromptCache()
}

/** 创建 soul 目录结构（mkdir 幂等） */
export const ensureSoulDirs = async (): Promise<void> => {
  await window.preload.fs.mkdir(getSoulMemoryDir(), true)
}

/** 读取长期记忆全文；未初始化时返回空串 */
export const readLongTermMemory = async (): Promise<string> => {
  const path = getSoulMemoryPath()
  if (!window.preload.fs.existsSync(path)) return ''
  try {
    return (await window.preload.fs.readTextFile(path)).trim()
  } catch {
    return ''
  }
}

/**
 * 全量覆写长期记忆。覆写前把现有内容备份到 MEMORY.md.bak（单代），
 * 自动合并与设置页手动编辑同受保护，任何环节写坏都可从备份找回。
 */
export const writeLongTermMemory = async (content: string): Promise<void> => {
  await ensureSoulDirs()
  const existing = await readLongTermMemory()
  if (existing) await window.preload.fs.writeTextFile(getSoulMemoryBackupPath(), existing)
  await window.preload.fs.writeTextFile(getSoulMemoryPath(), content)
  invalidateMemoryPromptCache()
}

/** 读取指定日期的短期记忆；无文件返回空串 */
export const readDayMemory = async (date: string): Promise<string> => {
  const path = getSoulMemoryDayPath(date)
  if (!window.preload.fs.existsSync(path)) return ''
  try {
    return (await window.preload.fs.readTextFile(path)).trim()
  } catch {
    return ''
  }
}

/** 删除指定日期的短期记忆文件（设置页管理用） */
export const removeDayMemory = async (date: string): Promise<void> => {
  const path = getSoulMemoryDayPath(date)
  if (window.preload.fs.existsSync(path)) await window.preload.fs.rm(path)
  invalidateMemoryPromptCache()
}

/**
 * 追加条目到指定日期的短期记忆（每行一条，调用方负责带时间 / 类别标注）。
 * 超过单日上限时从头部丢弃最旧条目；首条写入时才创建文件。
 */
export const appendDayMemory = async (date: string, newLines: string[]): Promise<void> => {
  if (newLines.length === 0) return
  const existing = await readDayMemory(date)
  const lines = [...existing.split('\n').filter(Boolean), ...newLines]
  while (lines.join('\n').length > DAY_MEMORY_MAX_CHARS && lines.length > 1) lines.shift()
  await ensureSoulDirs()
  await window.preload.fs.writeTextFile(getSoulMemoryDayPath(date), lines.join('\n'))
  invalidateMemoryPromptCache()
}

/** 已存在的每日记忆日期列表（升序） */
export const listDayMemoryDates = async (): Promise<string[]> => {
  const dir = getSoulMemoryDir()
  if (!window.preload.fs.existsSync(dir)) return []
  const entries = await window.preload.fs.readDir(dir)
  return entries
    .filter((e) => e.isFile && e.name.endsWith('.md'))
    .map((e) => e.name.replace(/\.md$/, ''))
    .sort()
}

let memoryPromptCache: { signature: string; content: string } | undefined

/**
 * 组装注入主 Agent 的记忆 system 消息：长期记忆全文 + 未合并每日文件（倒序、累计预算内）。
 * 按「开关 + MEMORY.md mtime + 各每日文件 mtime」签名缓存，避免 agent loop 每轮重复读盘；
 * 记忆系统未启用或无任何记忆时返回空串。
 */
export const buildMemoryPrompt = async (): Promise<string> => {
  const state = await readSoulState()
  if (!state.memoryEnabled) return ''
  const dates = await listDayMemoryDates()
  const longTerm = await readLongTermMemory()
  if (!longTerm && dates.length === 0) return ''

  // mtime 签名：MEMORY.md（stat）+ 每日文件（readDir 附带 mtime；目录可能尚未创建）
  const dayDir = getSoulMemoryDir()
  const dirEntries = new Map<string, number>(
    dates.length > 0 && window.preload.fs.existsSync(dayDir)
      ? (await window.preload.fs.readDir(dayDir)).map((e) => [e.name, e.mtime])
      : []
  )
  const memoryStat = window.preload.fs.existsSync(getSoulMemoryPath())
    ? await window.preload.fs.stat(getSoulMemoryPath())
    : undefined
  const signature = `${state.memoryEnabled}|${memoryStat?.mtime ?? 0}|${dates
    .map((d) => `${d}:${dirEntries.get(`${d}.md`) ?? 0}`)
    .join(',')}`
  if (memoryPromptCache && memoryPromptCache.signature === signature) {
    return memoryPromptCache.content
  }

  // 未合并每日文件 = 日期 >= lastConsolidateDate（合并只消费 < 今天的文件，今天的一律未合并）
  const pending = dates.filter((d) => d >= state.lastConsolidateDate)
  const daySections: string[] = []
  let budget = INJECT_DAY_BUDGET
  for (const date of [...pending].reverse()) {
    if (budget <= 0) break
    const content = await readDayMemory(date)
    if (!content) continue
    const clipped = content.length > budget ? content.slice(0, budget) : content
    daySections.push(`### ${date}\n${clipped}`)
    budget -= clipped.length
  }

  const parts: string[] = []
  if (longTerm) parts.push(`### 长期记忆\n${longTerm}`)
  if (daySections.length) parts.push(`### 近期短期记忆（按日期倒序）\n\n${daySections.join('\n\n')}`)
  const content =
    '## 记忆\n' +
    '以下是你在过往对话中积累的关于用户的记忆，回答时应结合这些背景；' +
    '新信息以近期短期记忆为准，发现记忆过时可在合适时机向用户确认更新：\n\n' +
    parts.join('\n\n')

  memoryPromptCache = { signature, content }
  return content
}

/** 记忆变更后清空注入缓存（写入操作统一调用，保证下一轮对话注入最新内容） */
export const invalidateMemoryPromptCache = (): void => {
  memoryPromptCache = undefined
}

/**
 * 记忆系统后台 LLM 调用（非流式）。
 * 只认「记忆模型」（设置-记忆），不做任何兜底：兜底会用上用户没预期参与记忆的模型，
 * 且让设置页无法如实判断「是否已配置」。未配置时抛错，设置页据此对提取 / 整理做门控。
 */
export const memoryChatCompletion = async (system: string, user: string): Promise<string> => {
  const modelKey = useSettingDefaultStore().state.defaultSummaryModel
  if (!modelKey) throw new Error('未配置记忆模型，请在「设置-记忆」中配置')
  const option = useSettingAiStore().optionMap.get(modelKey)
  if (!option) throw new Error('记忆模型已失效，请重新在「设置-记忆」中配置')
  const result = await createChatCompletion({
    baseURL: option.baseUrl,
    apiKey: option.key,
    format: option.format ?? 'chat',
    model: option.model,
    builtin: option.builtin,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  })
  return result.content.trim()
}
