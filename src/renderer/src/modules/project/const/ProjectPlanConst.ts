import type { ProjectPlanPriority, ProjectPlanStatus } from '@/entity'

export type TagTheme = 'default' | 'primary' | 'warning' | 'success' | 'danger'

export const PLAN_STATUSES: ProjectPlanStatus[] = ['padding', 'running', 'pause', 'complete']

export const PLAN_STATUS_META: Record<
  ProjectPlanStatus,
  { label: string; theme: TagTheme; tone: string }
> = {
  padding: { label: '待开始', theme: 'default', tone: 'neutral' },
  running: { label: '进行中', theme: 'primary', tone: 'active' },
  pause: { label: '已暂停', theme: 'warning', tone: 'paused' },
  complete: { label: '已结束', theme: 'success', tone: 'done' }
}

export const PLAN_PRIORITIES: ProjectPlanPriority[] = [1, 2, 3, 4]

export const PLAN_PRIORITY_META: Record<ProjectPlanPriority, { label: string; theme: TagTheme }> = {
  1: { label: '低', theme: 'default' },
  2: { label: '中', theme: 'primary' },
  3: { label: '高', theme: 'warning' },
  4: { label: '紧急', theme: 'danger' }
}
