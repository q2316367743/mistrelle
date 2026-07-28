import { BaseEntity } from '@/entity'

export type ProjectPlanStatus = 'padding' | 'running' | 'pause' | 'complete'
export type ProjectPlanPriority = 1 | 2 | 3 | 4

/**
 * 项目计划
 */
export interface ProjectPlan extends BaseEntity {
  // 标题
  title: string
  // 描述
  content: string
  // 状态
  status: ProjectPlanStatus
  // 开始日期：yyyy-MM-dd
  startDate: string
  // 结束日期：yyyy-MM-dd
  endDate: string
  // 优先级：低｜中｜高｜紧急
  priority: ProjectPlanPriority
  // 标签
  tags: string[]
}
