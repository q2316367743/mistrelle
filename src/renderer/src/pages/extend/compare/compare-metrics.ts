// ==========================================
//  模型对比检测：派生指标计算（UI 视图与 md 报告共用，避免两处口径漂移）。
//  - 全部为纯函数：最优标注 / 分类画像 / 观察摘要均为客观数据陈述，不做主观综合评分。
// ==========================================
import type { CompareModelResult } from './compare-types'

export const modelLabel = (result: CompareModelResult): string =>
  result.target.modelName || result.target.modelId

/**
 * 完整模型标识：提供方 · 模型名（同款模型不同供应商的横向对比场景必须能区分；
 * 报告表头 / 观察摘要 / 章节标题统一用此标识，参与模型明细表保留纯名 + 独立提供方列）。
 */
export const modelFullLabel = (result: CompareModelResult): string => {
  const name = result.target.modelName || result.target.modelId
  return result.target.provideName ? `${result.target.provideName} · ${name}` : name
}

export const fmtSec = (ms: number | null | undefined): string =>
  ms != null ? `${(ms / 1000).toFixed(2)}s` : '—'

export const fmtRate = (value: number | null | undefined): string =>
  value != null ? value.toFixed(1) : '—'

export const passRate = (result: CompareModelResult): number =>
  result.questions.length ? result.questionPassed / result.questions.length : 0

export const avgAnswerChars = (result: CompareModelResult): number =>
  result.questions.length
    ? Math.round(result.questions.reduce((sum, it) => sum + it.answerChars, 0) / result.questions.length)
    : 0

export const truncateCount = (result: CompareModelResult): number =>
  result.speedRuns.filter((it) => it.finishReason === 'length').length +
  result.questions.filter((it) => it.truncated).length

export const isStable = (result: CompareModelResult): boolean =>
  result.consistency.length > 0 && result.consistency.every((it) => it.allSame)

export interface MetricCell {
  text: string
  best: boolean
  /** 附加说明（如测速并发水位标注） */
  note: string
}

export interface OverviewMetricRow {
  metric: string
  cells: MetricCell[]
}

/** 对比总览行：指标 × 模型（TTFT 最小 / 生成速度与通过率最高 / 一致性稳定者标最优） */
export const buildOverviewRows = (results: CompareModelResult[]): OverviewMetricRow[] => {
  const ttftValues = results
    .map((it) => it.speedMedian?.ttftMs)
    .filter((it): it is number => it != null)
  const rateValues = results
    .map((it) => it.speedMedian?.tokPerSec)
    .filter((it): it is number => it != null)
  const ttftBest = ttftValues.length ? Math.min(...ttftValues) : null
  const rateBest = rateValues.length ? Math.max(...rateValues) : null
  const passBest = Math.max(0, ...results.map(passRate))
  const speedCell = (result: CompareModelResult, kind: 'ttft' | 'rate'): MetricCell => {
    const marks = result.speedRuns.map((it) => it.inFlight).filter((it) => it > 1)
    const note = marks.length ? `测速时并发 ${Math.max(...marks)}` : ''
    if (kind === 'ttft') {
      const value = result.speedMedian?.ttftMs
      return { text: fmtSec(value), best: value != null && ttftBest != null && value === ttftBest, note }
    }
    const value = result.speedMedian?.tokPerSec
    return { text: fmtRate(value), best: value != null && rateBest != null && value === rateBest, note }
  }
  const usageTotal = (result: CompareModelResult): string =>
    result.usage.promptTokens || result.usage.completionTokens
      ? `${result.usage.promptTokens} / ${result.usage.completionTokens}`
      : '未上报'
  return [
    { metric: '首字延迟（中位数）', cells: results.map((it) => speedCell(it, 'ttft')) },
    { metric: '生成速度 tok/s（中位数）', cells: results.map((it) => speedCell(it, 'rate')) },
    {
      metric: '题集通过率',
      cells: results.map((it) => ({
        text: it.questions.length ? `${it.questionPassed}/${it.questions.length}` : '—',
        best: it.questions.length > 0 && passRate(it) === passBest && passBest > 0,
        note: ''
      }))
    },
    {
      metric: '一致性',
      cells: results.map((it) => ({
        text: it.consistency.length ? (isStable(it) ? '稳定' : '有波动') : '—',
        best: it.consistency.length > 0 && isStable(it),
        note: ''
      }))
    },
    {
      metric: '平均回答字数',
      cells: results.map((it) => ({
        text: it.questions.length ? String(avgAnswerChars(it)) : '—',
        best: false,
        note: ''
      }))
    },
    {
      metric: '输出截断次数',
      cells: results.map((it) => ({ text: String(truncateCount(it)), best: false, note: '' }))
    },
    {
      metric: '累计 tokens（输入/输出）',
      cells: results.map((it) => ({ text: usageTotal(it), best: false, note: '' }))
    }
  ]
}

/** 分类能力画像行：tag × 模型通过率文本（✅ 全对 / ⚠️ 部分 / ❌ 全错） */
export const buildProfileRows = (results: CompareModelResult[]): Array<{ tag: string; cells: string[] }> => {
  const tags: string[] = []
  for (const item of results[0]?.questions ?? []) {
    if (!tags.includes(item.tag)) tags.push(item.tag)
  }
  return tags.map((tag) => ({
    tag,
    cells: results.map((result) => {
      const items = result.questions.filter((it) => it.tag === tag)
      if (!items.length) return '—'
      const passed = items.filter((it) => it.pass === true).length
      const rate = Math.round((passed / items.length) * 100)
      if (rate === 100) return `✅ ${passed}/${items.length}`
      if (rate > 0) return `⚠️ ${passed}/${items.length}`
      return `❌ 0/${items.length}`
    })
  }))
}

/** 观察摘要要点（客观数据陈述；无显著差异返回空数组） */
export const buildSummaryLines = (results: CompareModelResult[]): string[] => {
  const summary: string[] = []
  const ttftRanked = results
    .filter((it) => it.speedMedian?.ttftMs != null)
    .sort((a, b) => (a.speedMedian?.ttftMs ?? 0) - (b.speedMedian?.ttftMs ?? 0))
  if (ttftRanked.length >= 2) {
    summary.push(
      `首字延迟最快：${modelFullLabel(ttftRanked[0])}（${fmtSec(ttftRanked[0].speedMedian?.ttftMs)}），最慢：${modelFullLabel(ttftRanked[ttftRanked.length - 1])}（${fmtSec(ttftRanked[ttftRanked.length - 1].speedMedian?.ttftMs)}）`
    )
  }
  const rateRanked = results
    .filter((it) => it.speedMedian?.tokPerSec != null)
    .sort((a, b) => (b.speedMedian?.tokPerSec ?? 0) - (a.speedMedian?.tokPerSec ?? 0))
  if (rateRanked.length >= 2) {
    summary.push(
      `生成速度最高：${modelFullLabel(rateRanked[0])}（${fmtRate(rateRanked[0].speedMedian?.tokPerSec)} tok/s），最低：${modelFullLabel(rateRanked[rateRanked.length - 1])}（${fmtRate(rateRanked[rateRanked.length - 1].speedMedian?.tokPerSec)} tok/s）`
    )
  }
  const passRanked = [...results].sort((a, b) => passRate(b) - passRate(a))
  if (passRanked.length >= 2 && passRanked[0].questions.length > 0) {
    const last = passRanked[passRanked.length - 1]
    summary.push(
      `题集通过率最高：${modelFullLabel(passRanked[0])}（${passRanked[0].questionPassed}/${passRanked[0].questions.length}），最低：${modelFullLabel(last)}（${last.questionPassed}/${last.questions.length}）`
    )
  }
  const thinkers = results.filter((it) => it.speedRuns.some((run) => run.isThinking))
  if (thinkers.length) {
    summary.push(`思考型模型（输出思考流）：${thinkers.map(modelFullLabel).join('、')}`)
  }
  const unstable = results.filter((it) => it.consistency.length > 0 && !isStable(it))
  if (unstable.length) {
    summary.push(
      `一致性轮答案存在波动：${unstable.map(modelFullLabel).join('、')}（temperature=0 下同题多次回答不完全一致）`
    )
  }
  const truncated = results.filter((it) => truncateCount(it) >= 2)
  if (truncated.length) {
    summary.push(
      `输出截断较多（触达生成上限）：${truncated.map((it) => `${modelFullLabel(it)}（${truncateCount(it)} 次）`).join('、')}`
    )
  }
  return summary
}
