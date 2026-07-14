import { AiChatForm, AiChatItem } from '@/entity/ai'
import { listByAsync, saveListByAsync } from '@/utils/native'
import { defineStore } from 'pinia'
import { useLog } from '@/hooks/UseLog'
import { useSnowflake } from '@/hooks'

interface AiChatCache {
  list: Array<AiChatItem>
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
export const aiChatList = async (groupId: string): Promise<Array<AiChatItem>> => {
  const key = `/list/chat/${groupId}`
  const cache = aiChatCacheMap.get(key)
  if (cache) return cache.list
  const res = await listByAsync<AiChatItem>(key)
  aiChatCacheMap.set(key, res)
  return res.list
}

export const aiChatGet = async (groupId: string, id: string): Promise<AiChatItem | undefined> => {
  const list = await aiChatList(groupId)
  return list.find((e) => e.id === id)
}

export const aiChatAdd = async (groupId: string, form: AiChatForm) => {
  const key = `/list/chat/${groupId}`
  let cache = aiChatCacheMap.get(key)
  if (!cache) cache = await listByAsync<AiChatItem>(key)
  aiChatCacheMap.set(key, cache)
  const id = useSnowflake().nextId()
  const now = Date.now()
  cache.list.push({
    id: id,
    createdAt: now,
    updatedAt: now,
    name: form.content.substring(0, 10),
    form,
    top: false
  })
  cache.rev = await saveListByAsync(key, cache.list, cache.rev)
  return id
}

export const useAiChatStore = defineStore('ai-chat', () => {
  const logger = useLog({ name: 'ai-chat' })

  const state = ref<Array<AiChatItem>>([])

  const init = async () => {
    // 获取聊天列表
    state.value = await aiChatList('0')
  }

  init()
    .then(() => logger.debug('AI 聊天初始化成功'))
    .catch((e) => logger.error('AI 聊天初始化失败', e))

  const add = async (form: AiChatForm, groupId: string) => {
    const id = await aiChatAdd(groupId, form)
    if (groupId === '0') {
      // 更新缓存
      await init()
    }
    return id
  }

  return {
    state,

    add
  }
})
