// ==========================================
//  可用性检测工具：任务级风险结论计算 + 审计报告（markdown）生成（纯函数）。
//  报告在任务收尾（finished / stopped）时自动生成并随记录落库，历史里可随时重新生成。
// ==========================================
import dayjs from 'dayjs'

export const HEALTH_CONCLUSION_LABELS: Record<HealthConclusion, string> = {
  healthy: '健康',
  risky: '有风险',
  danger: '高风险',
  unknown: '未定'
}

export const HEALTH_STATUS_LABELS: Record<HealthItemStatus, string> = {
  pass: '通过',
  warn: '警告',
  fail: '失败',
  skip: '跳过'
}

export const HEALTH_TASK_STATUS_LABELS: Record<HealthTaskStatus, string> = {
  running: '检测中',
  finished: '已完成',
  stopped: '已停止'
}

/** 任务级风险结论：有 fail=高风险 / 有 warn=有风险 / 全过=健康；无有效项=未定 */
export const buildHealthConclusion = (items: HealthItemResult[]): HealthConclusion => {
  const valid = items.filter((it) => it.status !== 'skip')
  if (!valid.length) return 'unknown'
  if (valid.some((it) => it.status === 'fail')) return 'danger'
  if (valid.some((it) => it.status === 'warn')) return 'risky'
  return 'healthy'
}

/** 报告生成所需的任务数据（记录标量 + 解析后的 items / logs） */
export interface HealthReportSource {
  apiUrl: string
  modelId: string
  modelName: string | null
  provideName: string | null
  mode: HealthCheckMode
  status: HealthTaskStatus
  conclusion: HealthConclusion
  durationMs: number | null
  createdAt: number
  items: HealthItemResult[]
  logs: HealthLogEntry[]
}

const conclusionAdvice = (source: HealthReportSource): string => {
  const basic = source.mode === 'basic'
  if (source.conclusion === 'healthy') {
    return basic
      ? '未发现明显风险。基础检测仅覆盖核心项，如需完整评估（流式、计费合理性、能力基线等）请使用完整检测。'
      : '全部检测项通过，未发现明显风险。'
  }
  if (source.conclusion === 'danger') {
    const fails = source.items
      .filter((it) => it.status === 'fail')
      .map((it) => it.name)
      .join('、')
    return `存在失败项（${fails}），该接口 / 模型当前不可靠，建议排查网络与密钥或更换中转站后再试。`
  }
  if (source.conclusion === 'risky') {
    const warns = source.items
      .filter((it) => it.status === 'warn')
      .map((it) => it.name)
      .join('、')
    return `存在警告项（${warns}），建议关注下方警告明细后再决定是否日常使用。`
  }
  return '无有效检测项，无法给出结论。'
}

/** 生成审计报告 markdown（基本信息 / 风险结论 / 维度明细 / 结论建议 / 执行日志） */
export const buildHealthReport = (source: HealthReportSource): string => {
  const pass = source.items.filter((it) => it.status === 'pass').length
  const warn = source.items.filter((it) => it.status === 'warn').length
  const fail = source.items.filter((it) => it.status === 'fail').length
  const skip = source.items.filter((it) => it.status === 'skip').length
  const duration =
    source.durationMs != null ? `${(source.durationMs / 1000).toFixed(1)}s` : '—'
  const model = source.modelName ? `${source.modelName}（${source.modelId}）` : source.modelId

  const lines: string[] = [
    '# 模型可用性审计报告',
    '',
    `- 生成时间：${dayjs().format('YYYY-MM-DD HH:mm:ss')}`,
    `- 检测时间：${dayjs(source.createdAt).format('YYYY-MM-DD HH:mm:ss')}`,
    `- 目标地址：${source.apiUrl}`,
    `- 检测模型：${model}`,
    `- 提供方：${source.provideName ?? '手动填写'}`,
    `- 检测套餐：${source.mode === 'basic' ? '基础检测' : '完整检测'}（${source.items.length} 项）`,
    `- 任务状态：${HEALTH_TASK_STATUS_LABELS[source.status]}，总耗时 ${duration}`,
    `- 结果分布：通过 ${pass} / 警告 ${warn} / 失败 ${fail} / 跳过 ${skip}`,
    '',
    `## 风险结论：${HEALTH_CONCLUSION_LABELS[source.conclusion]}`,
    '',
    `> ${conclusionAdvice(source)}`,
    '',
    '## 检测项明细',
    '',
    '| 维度 | 检测项 | 结果 | 耗时 | 说明 |',
    '| --- | --- | --- | --- | --- |'
  ]
  for (const it of source.items) {
    const latency = it.latencyMs != null ? `${it.latencyMs}ms` : '—'
    const detail = (it.detail ?? '').replace(/\|/g, '\\|')
    lines.push(`| ${it.dimension} | ${it.name} | ${HEALTH_STATUS_LABELS[it.status]} | ${latency} | ${detail} |`)
  }
  lines.push('')
  lines.push('## 执行日志', '')
  for (const entry of source.logs) {
    const time = dayjs(entry.time).format('HH:mm:ss.SSS')
    lines.push(`- [${time}] [${entry.level}] ${entry.message}`)
  }
  lines.push('')
  lines.push('---', '', '*本报告由本地检测工具生成，检测结果仅供参考，不构成任何担保。*')
  return lines.join('\n')
}
