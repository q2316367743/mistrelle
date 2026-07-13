import { AiChat } from '@/entity/ai'
import { listByAsync } from '@/utils/native'

interface AiChatCache {
  list: Array<AiChat>
  rev?: string
}

/**
 * AiChat缓存
 * key => 缓存
 */
const aiChatCacheMap = new Map<string, AiChatCache>()

/**
 * 获取聊天列表
 * @param groupId 分组 ID
 */
export const aiChatList = async (groupId: string): Promise<Array<AiChat>> => {
  const key = `/list/chat/${groupId}`
  const cache = aiChatCacheMap.get(key)
  if (cache) return cache.list
  const res = await listByAsync<AiChat>(key)
  aiChatCacheMap.set(key, res)
  return res.list
}
