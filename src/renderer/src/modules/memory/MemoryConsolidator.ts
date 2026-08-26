import { useLog } from '@/hooks/UseLog'
import {
  MEMORY_MAX_CHARS,
  MEMORY_SECTIONS,
  nextDayKey,
  toDateKey,
  type MemoryCategory
} from './MemoryConstant'
import { MEMORY_CONSOLIDATE_PROMPT } from './MemoryPrompt'
import { extractPendingSessions } from './MemoryExtractor'
import {
  listDayMemoryDates,
  memoryChatCompletion,
  readDayMemory,
  readLongTermMemory,
  readSoulState,
  writeLongTermMemory,
  writeSoulState
} from './MemoryService'

const logger = useLog({ name: 'modules:memory-consolidator' })

let consolidating = false

export interface ConsolidateResult {
  ok: boolean
  message: string
}

/** 解析结果：类别 → 条目数组（已过滤非法项、压缩换行、去重） */
type MemorySectionsData = Partial<Record<MemoryCategory, string[]>>

const isMemoryCategory = (key: string): key is MemoryCategory =>
  MEMORY_SECTIONS.some((s) => s.category === key)

/**
 * 容错解析模型合并输出：截取首个 `{` 到末个 `}` 后 JSON.parse（天然容忍围栏与前后杂文），
 * 仅保留四个已知类别的合法条目；无法解析或四个类别全部缺失时返回 null。
 */
const parseMemoryJson = (raw: string): MemorySectionsData | null => {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const result: MemorySectionsData = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (!isMemoryCategory(key) || !Array.isArray(value)) continue
    const seen = new Set<string>()
    const items: string[] = []
    for (const entry of value) {
      if (typeof entry !== 'string') continue
      const item = entry.replace(/\s*\n+\s*/g, ' ').trim()
      if (!item || seen.has(item)) continue
      seen.add(item)
      items.push(item)
    }
    result[key] = items
  }
  return Object.keys(result).length > 0 ? result : null
}

/**
 * 分节预算裁剪 + 确定性渲染：markdown 结构由代码生成，不依赖模型输出格式。
 * 数组已要求按重要性降序，超预算只丢弃该节尾部（重要性最低）条目，不影响其它分节。
 */
const renderMemoryMarkdown = (data: MemorySectionsData): string => {
  const blocks: string[] = []
  for (const section of MEMORY_SECTIONS) {
    const items = data[section.category]
    if (!items || items.length === 0) continue
    const kept: string[] = []
    let used = 0
    for (const item of items) {
      const cost = item.length + 3 // "- " 前缀 + 换行
      if (used + cost > section.budget) break
      kept.push(item)
      used += cost
    }
    if (kept.length < items.length) {
      logger.warn(
        `「${section.header}」超出分节预算 ${section.budget} 字：保留前 ${kept.length} 条，丢弃尾部 ${items.length - kept.length} 条`
      )
    }
    if (kept.length > 0) blocks.push(`${section.header}\n${kept.map((i) => `- ${i}`).join('\n')}`)
  }
  return blocks.join('\n\n')
}

/**
 * 长期记忆合并（每日后台定时或设置页手动触发）：
 * 兜底补提漏提取会话 → 读取「日期 > lastConsolidateDate 且 < 今天」的每日文件 →
 * 与现有 MEMORY.md 一起交由 LLM 以 JSON 协议合并去重 → 分节预算裁剪后渲染回 markdown 写回。
 *
 * 数据安全：解析失败先重试一次，仍失败或四节全空则保留原长期记忆且不推进消费边界
 * （每日文件不删除，下次定时/手动自动重试同批数据）；裁剪只发生在超预算分节内部。
 *
 * lastConsolidateDate 语义为「下一个待消费日期（含边界）」：合并后推进到本次消费最大日期的
 * 下一天，消费条件为「日期 >= 该值 且 < 今天」，每个日期的文件恰好被消费一次。
 * 旧版语义（已消费最大日期 + 严格大于）的存量值可直接兼容：基线日文件至多被重新消费一次，
 * 由合并提示词去重吸收，无需数据迁移。注意：合并完成后若该日期文件又被追加（跨零点防抖
 * 落盘竞态），追加部分不会被再次消费。
 */
export const runConsolidation = async (
  options: { manual?: boolean } = {}
): Promise<ConsolidateResult> => {
  if (consolidating) return { ok: false, message: '整理进行中，请稍候' }
  consolidating = true
  try {
    const state = await readSoulState()
    // 定时触发时尊重开关；手动触发（设置页）不受限
    if (!state.memoryEnabled && !options.manual) return { ok: true, message: '记忆系统未启用' }
    const today = toDateKey()
    // 兜底补提须在待合并判断之前：否则「当天对话全部丢在防抖窗口内退出」时无每日文件可判，
    // 尾段永远漏提。补提产物写入今日文件，仍按 < 今天 的规则次日消费，不破坏合并边界
    await extractPendingSessions()
    const pending = (await listDayMemoryDates()).filter(
      (d) => d >= state.lastConsolidateDate && d < today
    )
    if (pending.length === 0) return { ok: true, message: '暂无待合并的短期记忆' }

    const sections: string[] = []
    for (const day of pending) {
      const content = await readDayMemory(day)
      if (content) sections.push(`### ${day}\n${content}`)
    }
    if (sections.length === 0) {
      // 有待合并日期但文件全为空：只推进边界，避免每日空跑
      state.lastConsolidateDate = nextDayKey(pending[pending.length - 1])
      await writeSoulState()
      return { ok: true, message: '暂无新增短期记忆' }
    }

    const longTerm = await readLongTermMemory()
    const user = [
      '## 现有长期记忆',
      longTerm || '（空，首次建立）',
      '',
      '## 新增短期记忆',
      sections.join('\n\n')
    ].join('\n')

    let data = parseMemoryJson(await memoryChatCompletion(MEMORY_CONSOLIDATE_PROMPT, user))
    if (!data) {
      logger.warn('合并输出不是合法 JSON，附加提醒后重试一次')
      data = parseMemoryJson(
        await memoryChatCompletion(
          MEMORY_CONSOLIDATE_PROMPT,
          `${user}\n\n（上次输出不是合法 JSON，请只输出 JSON 本体，不要任何其它内容）`
        )
      )
    }
    if (!data) {
      logger.warn('合并输出解析失败，保留原长期记忆，下次自动重试')
      return { ok: false, message: '合并输出解析失败，已保留原长期记忆，下次自动重试' }
    }
    const totalItems = MEMORY_SECTIONS.reduce(
      (sum, section) => sum + (data[section.category]?.length ?? 0),
      0
    )
    if (totalItems === 0) {
      // 四节条目全空大概率是模型异常而非记忆真被清空，保底不写入
      logger.warn('合并输出四节均为空，疑似模型异常，保留原长期记忆')
      return { ok: false, message: '合并输出为空，已保留原长期记忆，下次自动重试' }
    }

    let merged = renderMemoryMarkdown(data)
    if (merged.length > MEMORY_MAX_CHARS) {
      // 分节预算下理论上不会触发，最终兜底
      merged = merged.slice(0, MEMORY_MAX_CHARS)
      logger.warn(`合并输出超过总上限，已截断至 ${merged.length} 字`)
    }

    await writeLongTermMemory(merged)
    state.lastConsolidatedAt = new Date().toISOString()
    state.lastConsolidateDate = nextDayKey(pending[pending.length - 1])
    await writeSoulState()
    logger.info(`长期记忆已更新（合并 ${sections.length} 天短期记忆）`)
    return { ok: true, message: `已合并 ${sections.length} 天短期记忆` }
  } catch (e) {
    logger.error('长期记忆合并失败，保留原状待下次重试', e)
    return { ok: false, message: e instanceof Error ? e.message : '合并失败' }
  } finally {
    consolidating = false
  }
}
