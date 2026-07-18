import { AiChatForm, AiChatItem } from '@/entity/ai'
import { listByAsync, removeOneByAsync, saveListByAsync } from '@/utils/native'
import { defineStore } from 'pinia'
import { useLog } from '@/hooks/UseLog'
import { useSnowflake } from '@/hooks'
import { useChatName } from '@/modules/chat/UseChatName'
import { LocalNameEnum } from '@/global/LocalNameEnum'

interface AiChatCache {
  list: Array<AiChatItem>
  rev?: string
}

/**
 * AiChat缓存
 * key => 缓存
 */
const aiChatCacheMap = new Map<string, AiChatCache>()

const buildKey = (agentId: string) => `/list/chat/${agentId}`

/**
 * 获取聊天列表
 * @param agentId 分组 ID
 */
export const aiChatList = async (agentId: string): Promise<Array<AiChatItem>> => {
  const key = buildKey(agentId)
  const cache = aiChatCacheMap.get(key)
  if (cache) return cache.list
  const res = await listByAsync<AiChatItem>(key)
  aiChatCacheMap.set(key, res)
  return res.list
}

export const aiChatGet = async (agentId: string, id: string): Promise<AiChatItem | undefined> => {
  const list = await aiChatList(agentId)
  return list.find((e) => e.id === id)
}

export const aiChatAdd = async (agentId: string, form: AiChatForm) => {
  const key = buildKey(agentId)
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

export const aiChatUpdate = async (agentId: string, id: string, target: Partial<AiChatItem>) => {
  const key = buildKey(agentId)
  let cache = aiChatCacheMap.get(key)
  if (!cache) cache = await listByAsync<AiChatItem>(key)
  aiChatCacheMap.set(key, cache)
  let index = cache.list.findIndex((e) => e.id === id)
  if (index >= 0) {
    cache.list[index] = {
      ...cache.list[index],
      ...target,
      updatedAt: Date.now()
    }
    cache.rev = await saveListByAsync(key, cache.list, cache.rev)
  }
}

const aiChatRename = async (agentId: string, id: string) => {
  const target = await aiChatGet(agentId, id)
  if (target) {
    const name = await useChatName(target.form.content)
    await aiChatUpdate(agentId, id, { name })
  }
}

export const aiChatRemoveAll = async (agentId: string) => {
  const key = buildKey(agentId)
  let cache = aiChatCacheMap.get(key)
  if (!cache) cache = await listByAsync<AiChatItem>(key)

  try {
    for (let aiChatItem of cache.list) {
      await removeOneByAsync(LocalNameEnum.LIST_AI_CHAT(aiChatItem.id))
    }
  } finally {
    await removeOneByAsync(key)
    aiChatCacheMap.delete(key)
  }
}

const aiChatRemove = async (agentId: string, id: string) => {
  const key = buildKey(agentId)
  let cache = aiChatCacheMap.get(key)
  if (!cache) cache = await listByAsync<AiChatItem>(key)
  aiChatCacheMap.set(key, cache)
  let index = cache.list.findIndex((e) => e.id === id)
  if (index >= 0) {
    cache.list.splice(index, 1)
    cache.rev = await saveListByAsync(key, cache.list, cache.rev)
    // 删除聊天记录
    LocalNameEnum.LIST_AI_CHAT(id)
  }
}

export const useAiChatStore = defineStore('ai-chat', () => {
  const logger = useLog({ name: 'store:ai-chat' })

  const state = ref<Array<AiChatItem>>([])

  const init = async () => {
    // 获取聊天列表
    state.value = await aiChatList('0')
  }

  init()
    .then(() => logger.debug('AI 聊天初始化成功'))
    .catch((e) => logger.error('AI 聊天初始化失败', e))

  const add = async (form: AiChatForm, agentId: string) => {
    const id = await aiChatAdd(agentId, form)
    if (agentId === '0') {
      // 更新缓存
      await init()
    }
    // 生成聊天消息
    logger.debug('AI 聊天消息生成')
    aiChatRename(agentId, id).finally(() => {
      if (agentId === '0') {
        init()
      }
    })
    return id
  }

  const remove = async (agentId: string, id: string) => {
    await aiChatRemove(agentId, id)
    if (agentId === '0') {
      // 更新缓存
      await init()
    }
  }

  return {
    state,

    add,
    remove
  }
})
