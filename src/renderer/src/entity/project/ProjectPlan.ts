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

/**
 * 计划日志类型（按"修改前后差值"自动生成；不含变更人）
 */
export type ProjectPlanLogType =
  | 'create'      // 创建了待办
  | 'priority'    // 修改优先级
  | 'status'      // 修改状态
  | 'date'        // 修改日期
  | 'tags'        // 修改标签
  | 'attachment'  // 添加/删除附件
  | 'comment'     // 评论

/**
 * 计划日志：持久化到 plan/{planId}/logs.json
 */
export interface ProjectPlanLog extends BaseEntity {
  type: ProjectPlanLogType
  // 展示用文案（comment 时即为评论正文）
  description: string
  // 自动生成描述时的结构化数据（可空）
  meta?: { field?: string; from?: string | number; to?: string | number }
}
