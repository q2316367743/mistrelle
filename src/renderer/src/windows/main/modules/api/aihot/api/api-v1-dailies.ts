import { requestJson } from '@/plugin/http'
import type { AihotDailiesResponse } from '../types'

/**
 * 日报归档索引（按日期最新在前，每天 08:00 上海时间发布一期）
 * @param limit 1–180，默认 30
 */
export const aihotApiV1Dailies = async (limit?: number) => {
  const { data } = await requestJson<AihotDailiesResponse>({
    baseURL: 'https://aihot.virxact.com',
    url: '/api/v1/dailies',
    method: 'GET',
    params: { limit }
  })
  return data
}
