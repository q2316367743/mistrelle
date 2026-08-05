import { BaseEntity } from '@/entity'

export interface AiWorkspaceForm {
  // 项目名称
  name: string
  // 项目路径
  path: string
  // 项目默认模型
  defaultModel: string
  // 强调色
  color: string
}

export interface AiWorkspace extends BaseEntity, AiWorkspaceForm {}
