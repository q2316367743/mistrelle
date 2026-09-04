import { requestJson } from '@/plugin/http'
import type { AihotItemsResponse } from '../types'

export interface ApiV1ItemsParam {
  /** selected=精选（默认），all=全部 */
  mode?: 'selected' | 'all'
  /** 当前值：ai-models / ai-products / industry / paper / tip */
  category?: string
  /** 检索窗口，默认 7d */
  window?: '24h' | '7d'
  /** 窗口与排序所用时间戳，默认 timeline */
  by?: 'timeline' | 'published'
  /** 关键词（去首尾空白后 2–200 码点） */
  q?: string
  /** 1–100，默认 50 */
  limit?: number
  /** 上页 page.nextCursor（不透明，仅同查询复用） */
  cursor?: string
}

/**
 * 列出近期公开 AI 条目（仅覆盖最近 7 天，窗口化，不用于完整镜像）
 */
export const aihotApiV1Items = async (params: ApiV1ItemsParam = {}) => {
  const { data } = await requestJson<AihotItemsResponse>({
    baseURL: 'https://aihot.virxact.com',
    url: '/api/v1/items',
    method: 'GET',
    params
  })
  return data
}
