import { requestJson } from '@/plugin/http'
import type { AihotSelectedSnapshot } from '../types'

export interface ApiV1SelectedSnapshotParam {
  /** default=完整字段，minimal=约省 4 倍体积 */
  fields?: 'default' | 'minimal'
  /** 1–1000，默认 500 */
  limit?: number
  /** 续页游标（上一页返回的 nextPage） */
  page?: string
}

/**
 * 精选集全量快照（一次性引导：分页直到 hasMore=false，全集数千条且只增不减；
 * 保留第一页的 cursor 供 aihotApiV1SelectedChanges 做增量同步）
 */
export const aihotApiV1SelectedSnapshot = async (params: ApiV1SelectedSnapshotParam = {}) => {
  const { data } = await requestJson<AihotSelectedSnapshot>({
    baseURL: 'https://aihot.virxact.com',
    url: '/api/v1/selected/snapshot',
    method: 'GET',
    params
  })
  return data
}
