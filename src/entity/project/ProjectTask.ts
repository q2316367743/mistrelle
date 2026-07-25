import { BaseEntity } from '@/entity'

export type ProjectTaskStatus = 'padding' | 'running' | 'pause' | 'complete'
export type ProjectTaskPriority = 1 | 2 | 3 | 4

/**
 * 项目计划
 */
export interface ProjectTask extends BaseEntity {
  // 标题
  title: string
  // 描述
  content: string
  // 状态
  status: ProjectTaskStatus
  // 开始日期：yyyy-MM-dd
  startDate: string
  // 结束日期：yyyy-MM-dd
  endDate: string
  // 优先级：低｜中｜高｜紧急
  priority: ProjectTaskPriority
  // 标签
  tags: string[]
}
