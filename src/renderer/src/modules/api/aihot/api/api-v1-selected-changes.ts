import { requestJson } from '@/plugin/http'
import type { AihotSelectedChanges } from '../types'

export interface ApiV1SelectedChangesParam {
  /** 账本水位游标（snapshot 第一页返回的 cursor，不按时钟过期），必填 */
  cursor: string
  /** 1–100，默认 100 */
  limit?: number
}

/**
 * 精选集原子变更（先应用页面再保存新 cursor；
 * 返回 409 snapshot_required 表示游标失效，需重新走快照引导）
 */
export const aihotApiV1SelectedChanges = async (params: ApiV1SelectedChangesParam) => {
  const { data } = await requestJson<AihotSelectedChanges>({
    baseURL: 'https://aihot.virxact.com',
    url: '/api/v1/selected/changes',
    method: 'GET',
    params
  })
  return data
}
