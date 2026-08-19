import { useLog } from '@/hooks/UseLog'
import { MEMORY_MAX_CHARS, toDateKey } from './MemoryConstant'
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

/**
 * 长期记忆合并（每日后台定时或设置页手动触发）：
 * 兜底补提漏提取会话 → 读取「日期 > lastConsolidateDate 且 < 今天」的每日文件 →
 * 与现有 MEMORY.md 一起交由 LLM 合并去重 → 长度硬保护后写回。
 *
 * lastConsolidateDate 语义为「已完全消费的最大文件日期」：合并后推进到本次消费的最大日期
 * （而非今天），同日稍后追加的条目次日仍会被重新消费，不丢内容。
 */
export const runConsolidation = async (options: { manual?: boolean } = {}): Promise<ConsolidateResult> => {
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
      (d) => d > state.lastConsolidateDate && d < today
    )
    if (pending.length === 0) return { ok: true, message: '暂无待合并的短期记忆' }

    const sections: string[] = []
    for (const day of pending) {
      const content = await readDayMemory(day)
      if (content) sections.push(`### ${day}\n${content}`)
    }
    if (sections.length === 0) {
      // 有待合并日期但文件全为空：只推进边界，避免每日空跑
      state.lastConsolidateDate = pending[pending.length - 1]
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

    let merged = await memoryChatCompletion(MEMORY_CONSOLIDATE_PROMPT, user)
    // 模型可能无视指令带代码块围栏，剥掉
    merged = merged.replace(/^```(?:markdown)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '').trim()
    if (!merged) throw new Error('模型未返回内容')

    // 长度硬保护：超上限按行（条目）截断，单行超长时直接字符截断
    if (merged.length > MEMORY_MAX_CHARS) {
      const lines = merged.split('\n')
      while (lines.join('\n').length > MEMORY_MAX_CHARS && lines.length > 1) lines.pop()
      merged = lines.join('\n')
      if (merged.length > MEMORY_MAX_CHARS) merged = merged.slice(0, MEMORY_MAX_CHARS)
      logger.warn(`合并输出超过长度上限，已截断至 ${merged.length} 字`)
    }

    await writeLongTermMemory(merged)
    state.lastConsolidateDate = pending[pending.length - 1]
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
