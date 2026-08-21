import { requestJson } from '@/plugin/http'
import type { AihotHotTopicsResponse } from '../types'

/**
 * 当前多来源热门榜（AIHOT Top 10，按多源覆盖与讨论热度排名）
 */
export const aihotApiV1HotTopics = async () => {
  const { data } = await requestJson<AihotHotTopicsResponse>({
    baseURL: 'https://aihot.virxact.com',
    url: '/api/v1/hot-topics',
    method: 'GET'
  })
  return data
}
