import { requestJson } from '@/plugin/http'
import type { AihotDailyResponse } from '../types'

/**
 * 按上海日期取日报（过去报告不可变，可永久缓存）
 * @param date 上海日期，格式 YYYY-MM-DD
 */
export const aihotApiV1DailiesDate = async (date: string) => {
  const { data } = await requestJson<AihotDailyResponse>({
    baseURL: 'https://aihot.virxact.com',
    url: `/api/v1/dailies/${encodeURIComponent(date)}`,
    method: 'GET'
  })
  return data
}
