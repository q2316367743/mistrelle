import type { ProjectPlan, ProjectPlanPriority } from '@/entity/project/ProjectPlan'
import { PLAN_PRIORITY_META } from '@/modules/project'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * yyyy-MM-dd
 */
export const formatYmd = (ts: number): string => {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const todayYmd = (): string => formatYmd(Date.now())

export const parseYmd = (s: string): number => {
  if (!s) return NaN
  const [y, m, d] = s.split('-').map((n) => Number(n))
  if (!y || !m || !d) return NaN
  return new Date(y, m - 1, d).getTime()
}

/**
 * 计划是否逾期：结束日期 < 今天 且 未完成
 */
export const isPlanOverdue = (plan: Pick<ProjectPlan, 'status' | 'endDate'>): boolean => {
  if (plan.status === 'complete') return false
  const end = parseYmd(plan.endDate)
  if (Number.isNaN(end)) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return end < today.getTime()
}

export const priorityLabel = (p: ProjectPlanPriority): string => PLAN_PRIORITY_META[p].label

export const dayDiff = (start: string, end: string): number | null => {
  const s = parseYmd(start)
  const e = parseYmd(end)
  if (Number.isNaN(s) || Number.isNaN(e)) return null
  return Math.round((e - s) / MS_PER_DAY)
}
