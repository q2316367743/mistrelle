export interface CreateMemoryPayload {
  time: number
  content: string
  vector: number[]
}

export interface QueryMemoryPayload {
  startTime?: number
  endTime?: number
  vector?: number[]
  content?: string
  enabled?: boolean
  pageNum?: number
  pageSize?: number
}

export interface QueryMemoryResultItem {
  id: string
  content: string
  enabled: boolean
  createTime: number
  updateTime: number
  _distance?: number
}

export interface QueryMemoryResult {
  list: QueryMemoryResultItem[]
  total: number
  pageNum: number
  pageSize: number
}
