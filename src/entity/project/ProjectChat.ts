import { BaseEntity } from '@/entity'

/**
 * 项目任务索引条目（tasks/index.json 中的轻量元信息）
 */
export interface ProjectChat extends BaseEntity {
  name: string
  preview?: string
  previewModel?: string
}
