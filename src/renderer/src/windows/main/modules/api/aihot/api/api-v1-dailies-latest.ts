import { requestJson } from '@/plugin/http'
import type { AihotDailyResponse } from '../types'

/**
 * 最新日报
 */
export const aihotApiV1DailiesLatest = async () => {
  const { data } = await requestJson<AihotDailyResponse>({
    baseURL: 'https://aihot.virxact.com',
    url: '/api/v1/dailies/latest',
    method: 'GET'
  })
  return data
}
