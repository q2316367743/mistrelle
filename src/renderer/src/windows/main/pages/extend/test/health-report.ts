// ==========================================
//  可用性检测工具：任务级风险结论计算 + 审计报告（HTML）view model 组装。
//  - 报告不落库（数据库只存关键数据）：由记录标量 + items / logs 动态生成，
//    模板为 resources/templates/model-health-report.ejs，渲染在主进程（window.preload.template.render）。
//  - 本文件只做 view model 预处理（结论徽章 / 统计卡 / 维度分组 / 日志格式化），模板侧纯展示循环。
// ==========================================
import dayjs from 'dayjs'
import { HEALTH_DIMENSIONS } from './health-check-items'

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

/** 报告生成所需的任务数据（记录标量 + 解析后的 items / logs） */
export interface HealthReportSource {
  id: string
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

/** 任务级风险结论：有 fail=高风险 / 有 warn=有风险 / 全过=健康；无有效项=未定 */
export const buildHealthConclusion = (items: HealthItemResult[]): HealthConclusion => {
  const valid = items.filter((it) => it.status !== 'skip')
  if (!valid.length) return 'unknown'
  if (valid.some((it) => it.status === 'fail')) return 'danger'
  if (valid.some((it) => it.status === 'warn')) return 'risky'
  return 'healthy'
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

/**
 * 生成审计报告 HTML（自包含单文件，可直接 iframe 预览 / 落盘分享，浏览器 Ctrl+P 可另存 PDF）。
 * 动态生成不落库，模板见 resources/templates/model-health-report.ejs（EJS <%= %> 默认转义）。
 */
export const buildHealthReport = async (source: HealthReportSource): Promise<string> => {
  const counts = {
    pass: source.items.filter((it) => it.status === 'pass').length,
    warn: source.items.filter((it) => it.status === 'warn').length,
    fail: source.items.filter((it) => it.status === 'fail').length,
    skip: source.items.filter((it) => it.status === 'skip').length
  }
  const viewModel = {
    title: '模型可用性审计报告',
    checkedAt: dayjs(source.createdAt).format('YYYY-MM-DD HH:mm:ss'),
    generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    conclusion: {
      label: HEALTH_CONCLUSION_LABELS[source.conclusion],
      tone: source.conclusion
    },
    stats: [
      { label: '通过', value: counts.pass, tone: 'healthy' },
      { label: '警告', value: counts.warn, tone: 'risky' },
      { label: '失败', value: counts.fail, tone: 'danger' },
      { label: '跳过', value: counts.skip, tone: 'unknown' }
    ],
    info: [
      { label: '目标地址', value: source.apiUrl },
      {
        label: '检测模型',
        value: source.modelName ? `${source.modelName}（${source.modelId}）` : source.modelId
      },
      { label: '提供方', value: source.provideName ?? '手动填写' },
      { label: '检测套餐', value: source.mode === 'basic' ? '基础检测' : '完整检测' },
      { label: '任务状态', value: HEALTH_TASK_STATUS_LABELS[source.status] },
      {
        label: '总耗时',
        value: source.durationMs != null ? `${(source.durationMs / 1000).toFixed(1)}s` : '—'
      },
      { label: '任务 ID', value: source.id }
    ],
    advice: conclusionAdvice(source),
    itemCount: source.items.length,
    groups: HEALTH_DIMENSIONS.map((dimension) => ({
      dimension,
      items: source.items
        .filter((it) => it.dimension === dimension)
        .map((it) => ({
          statusLabel: HEALTH_STATUS_LABELS[it.status],
          statusTone: it.status === 'pass' ? 'healthy' : it.status === 'warn' ? 'risky' : it.status === 'fail' ? 'danger' : 'unknown',
          name: it.name,
          latency: it.latencyMs != null ? `${it.latencyMs}ms` : '—',
          detail: it.detail ?? ''
        }))
    })).filter((group) => group.items.length > 0),
    logs: source.logs.map((l) => ({
      time: dayjs(l.time).format('HH:mm:ss.SSS'),
      level: l.level,
      message: l.message
    }))
  }
  return window.preload.template.render({ name: 'model-health-report', data: viewModel })
}
