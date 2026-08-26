// ==========================================
//  模型对比检测：审计报告（markdown）view model 组装与落盘。
//  - 模板 resources/templates/model-compare-report.ejs，主进程 EJS 渲染
//    （window.preload.template.render）→ 落盘 ~/.mistrelle/compare/{id}.md。
//  - md 输出非 HTML：模板插值用 <%- %> 原样输出（EJS <%= %> 的 HTML 实体转义会污染
//    代码 / JSON 答案文本），所有落模板文本经 mdCell 统一清洗（压空白 / 转义竖线 / 截断）。
//  - 指标计算复用 compare-metrics（与 UI 总览同口径）；摘要 / 最优标注均为客观数据陈述。
// ==========================================
import dayjs from 'dayjs'
import type { CompareRecord } from './compare-types'
import { COMPARE_EXEC_MODE_LABELS, COMPARE_TASK_STATUS_LABELS } from './compare-types'
import {
  avgAnswerChars,
  buildOverviewRows,
  buildProfileRows,
  buildSummaryLines,
  fmtRate,
  fmtSec,
  modelLabel,
  truncateCount
} from './compare-metrics'

/** md 表格单元格清洗：压空白 → 截断 → 转义竖线（顺序保证转义不超长） */
const mdCell = (text: string, max = 80): string =>
  text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .replace(/\|/g, '\\|')

/** 多行文本 → md 引用块（逐行清洗，保留换行结构） */
const mdLines = (text: string, max = 400): string[] =>
  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .slice(0, 30)
    .map((line) => `> ${mdCell(line, max) || ' '}`)

// ── view model 结构（模板数据契约） ─────────────────

export interface MdCell {
  text: string
  best: boolean
  /** 附加说明（如并发水位标注），空串则不显示 */
  note: string
}

export interface CompareReportVm {
  title: string
  timeText: string
  generatedText: string
  statusLabel: string
  durationText: string
  execModeLabel: string
  speedRunsLabel: string
  consistencyCountLabel: string
  modelNames: string[]
  modelMetas: Array<{ name: string; provide: string; apiUrl: string; modelId: string; format: string }>
  summary: string[]
  overviewRows: Array<{ metric: string; cells: MdCell[] }>
  profileRows: Array<{ tag: string; cells: string[] }>
  features: Array<{ name: string; lines: string[] }>
  speedDetails: Array<{
    name: string
    medianText: string
    runs: Array<{ index: string; ttft: string; think: string; rate: string; tokens: string; inFlight: string; finish: string; error: string }>
  }>
  identityItems: Array<{ name: string; latency: string; error: string; lines: string[] }>
  questionRows: Array<{ tag: string; question: string; reference: string; cells: string[] }>
  answerBlocks: Array<{ name: string; items: Array<{ tag: string; lines: string[] }> }>
  consistencyItems: Array<{ name: string; items: Array<{ tag: string; allSameLabel: string; answerLines: string[] }> }>
  concurrencyNote: string
  logs: Array<{ time: string; level: string; message: string }>
}

/** 组装报告 view model（模板只做展示循环） */
export const buildCompareReportVm = (record: CompareRecord): CompareReportVm => {
  const { results } = record
  const modelNames = results.map(modelLabel)

  // 模型特征段
  const features = results.map((result) => {
    const thinkRuns = result.speedRuns.filter((it) => it.isThinking && it.thinkMs != null)
    const lines = [
      thinkRuns.length
        ? `思考型：出现思考流，首个思考块平均 ${fmtSec(Math.round(thinkRuns.reduce((s, it) => s + (it.thinkMs ?? 0), 0) / thinkRuns.length))}`
        : '直出型：未出现思考流',
      `首字延迟中位数 ${fmtSec(result.speedMedian?.ttftMs)} · 生成 ${fmtRate(result.speedMedian?.tokPerSec)} tok/s`,
      `题集 ${result.questionPassed}/${result.questions.length} 通过 · 平均回答 ${avgAnswerChars(result)} 字`,
      `一致性轮 ${result.consistency.filter((it) => it.allSame).length}/${result.consistency.length} 稳定`,
      `累计 tokens：输入 ${result.usage.promptTokens} / 输出 ${result.usage.completionTokens} · 截断 ${truncateCount(result)} 次`
    ]
    if (result.error) lines.push(`异常：${result.error}`)
    return { name: modelLabel(result), lines }
  })

  const speedDetails = results.map((result) => ({
    name: modelLabel(result),
    medianText: `${fmtSec(result.speedMedian?.ttftMs)} / ${fmtRate(result.speedMedian?.tokPerSec)} tok/s`,
    runs: result.speedRuns.map((run, index) => ({
      index: `${index + 1}`,
      ttft: fmtSec(run.ttftMs),
      think: run.isThinking ? fmtSec(run.thinkMs) : '—',
      rate: fmtRate(run.tokPerSec),
      tokens:
        run.completionTokens != null
          ? `${run.completionTokens}（${run.tokenSource === 'usage' ? '精确' : '估算'}）`
          : '—',
      inFlight: String(run.inFlight),
      finish: run.finishReason ?? '—',
      error: run.error ? mdCell(run.error, 60) : ''
    }))
  }))

  const identityItems = results.map((result) => ({
    name: modelLabel(result),
    latency: result.identity ? fmtSec(result.identity.latencyMs) : '—',
    error: result.identity?.error ? mdCell(result.identity.error, 60) : '',
    lines: result.identity?.content ? mdLines(result.identity.content) : []
  }))

  // 题集矩阵（✅/❌/⚠️ 截断或失败/— 缺失）+ 参考答案
  const questionRows = (results[0]?.questions ?? []).map((base) => ({
    tag: base.tag,
    question: mdCell(base.question, 60),
    reference: mdCell(base.reference, 40),
    cells: results.map((result) => {
      // 按 key 对齐（中断的模型可能缺尾部题，顺序对齐不可靠）
      const item = result.questions.find((q) => q.key === base.key)
      if (!item) return '—'
      if (item.error) return '⚠️ 失败'
      const mark = item.pass === true ? '✅' : item.pass === false ? '❌' : '⚠️'
      return `${mark}${item.truncated ? '（截断）' : ''}`
    })
  }))

  // 答案全文块（按模型 × 题目，供人工复核）
  const answerBlocks = results.map((result) => ({
    name: modelLabel(result),
    items: result.questions.map((item) => ({
      tag: item.tag,
      lines: item.error
        ? [`> 请求失败：${mdCell(item.error, 100)}`]
        : item.answer
          ? mdLines(item.answer, 200)
          : ['> （空回答）']
    }))
  }))

  const consistencyItems = results.map((result) => ({
    name: modelLabel(result),
    items: result.consistency.map((item) => ({
      tag: item.tag,
      allSameLabel: item.error ? '失败' : item.allSame ? '三次一致' : '存在波动',
      answerLines: item.error
        ? [`> 请求失败：${mdCell(item.error, 100)}`]
        : item.answers.map((answer, i) => `> 第${i + 1}次：${mdCell(answer, 160)}`)
    }))
  }))

  return {
    title: '模型对比检测报告',
    timeText: dayjs(record.createdAt).format('YYYY-MM-DD HH:mm:ss'),
    generatedText: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    statusLabel: COMPARE_TASK_STATUS_LABELS[record.status],
    durationText: record.durationMs != null ? `${(record.durationMs / 1000).toFixed(1)}s` : '—',
    execModeLabel: COMPARE_EXEC_MODE_LABELS[record.config.execMode],
    speedRunsLabel: String(record.config.speedRuns),
    consistencyCountLabel: String(record.config.consistencyCount),
    modelNames,
    modelMetas: results.map((it) => ({
      name: modelLabel(it),
      provide: it.target.provideName || '—',
      apiUrl: it.target.apiUrl,
      modelId: it.target.modelId,
      format: it.target.format
    })),
    summary: buildSummaryLines(results),
    overviewRows: buildOverviewRows(results),
    profileRows: buildProfileRows(results),
    features,
    speedDetails,
    identityItems,
    questionRows,
    answerBlocks,
    consistencyItems,
    concurrencyNote:
      '并发说明：速度指标受共享网络带宽、同一提供方限流与本地并发解析影响。总览表中已对测速时存在并发（水位 >1）的模型标注并发数；混合模式速度轮为逐模型串行（水位恒为 1，指标最纯净），全并发模式下各模型同时测速（互相影响对称但绝对值偏低）。题集 / 一致性 / 身份轮为质量指标，不受并发影响。',
    logs: record.logs.map((it) => ({
      time: dayjs(it.time).format('HH:mm:ss.SSS'),
      level: it.level,
      message: mdCell(it.message, 200)
    }))
  }
}

/** 渲染报告 md 字符串（不落盘）：报告是用户手动导出产物，由 composable 的 exportReport 弹 dialog.save 让用户自选路径 */
export const renderCompareReport = async (record: CompareRecord): Promise<string> =>
  window.preload.template.render({
    name: 'model-compare-report',
    data: buildCompareReportVm(record) as unknown as Record<string, unknown>
  })
