import { requestJson } from '@/plugin/http'
import type { AihotStoryResponse } from '../types'

/**
 * 获取单个故事（事件）及时间线与 AI 摘要
 * @param publicId 故事公开 ID（hot-topics 返回的 links.story URL 末段）
 */
export const aihotApiV1Stories = async (publicId: string) => {
  const { data } = await requestJson<AihotStoryResponse>({
    baseURL: 'https://aihot.virxact.com',
    url: `/api/v1/stories/${encodeURIComponent(publicId)}`,
    method: 'GET'
  })
  return data
}
