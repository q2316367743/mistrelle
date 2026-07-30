import { BaseEntity } from '@/entity'

/**
 * 项目任务索引条目（tasks/index.json 中的轻量元信息）
 */
export interface ProjectChat extends BaseEntity {
  // 任务名称
  name: string
  // 预览文本
  preview?: string
  // 预览模型
  previewModel?: string
  // 计划ID
  planId?: string
}
