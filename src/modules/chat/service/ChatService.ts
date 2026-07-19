import { AiChatForm, AiChatItem } from '@/entity/ai'
import { useSnowflake } from '@/hooks'
import { getAppData2Chat } from '@/global/Constant'
import { ChatMessage } from '@/domain'

interface AiChatCache {
  // 列表
  list: Array<AiChatItem>
  // 索引文件
  path: string
}

/**
 * AiChat缓存
 * key => 缓存
 */
const aiChatCacheMap = new Map<string, AiChatCache>()

const buildChatFolderPath = (agentId: string) =>
  window.preload.path.join(getAppData2Chat(), agentId)
const buildChatIndexPath = (agentId: string, folder?: string) =>
  window.preload.path.join(folder || buildChatFolderPath(agentId), 'index.json')
export const buildChatChatPath = (agentId: string, id: string) =>
  window.preload.path.join(buildChatFolderPath(agentId), id + '.json')

const aiChatListWrap = async (agentId: string): Promise<AiChatCache> => {
  const cache = aiChatCacheMap.get(agentId)
  if (cache) return cache
  const folder = buildChatFolderPath(agentId)
  const indexPath = buildChatIndexPath(agentId, folder)
  if (!window.preload.fs.existsSync(folder)) {
    // 创建目录
    await window.preload.fs.mkdir(folder)
    // 创建默认索引文件
    await window.preload.fs.writeTextFile(indexPath, JSON.stringify([]))
    return { list: [], path: indexPath }
  }
  if (!window.preload.fs.existsSync(indexPath)) {
    // 写入默认数组
    await window.preload.fs.writeTextFile(indexPath, JSON.stringify([]))
    return { list: [], path: indexPath }
  }
  const text = await window.preload.fs.readTextFile(indexPath)
  return { list: JSON.parse(text), path: indexPath }
}

const aiChatSave = async (agentId: string, path: string, list: Array<AiChatItem>) => {
  await window.preload.fs.writeTextFile(path, JSON.stringify(list))
  aiChatCacheMap.set(agentId, { path, list })
}

/**
 * 获取聊天列表
 * @param agentId 分组 ID
 */
export const aiChatList = async (agentId: string): Promise<Array<AiChatItem>> => {
  const cache = aiChatCacheMap.get(agentId)
  if (cache) return cache.list
  const ca = await aiChatListWrap(agentId)
  aiChatCacheMap.set(agentId, ca)
  return ca.list
}

export const aiChatGet = async (agentId: string, id: string): Promise<AiChatItem | undefined> => {
  const list = await aiChatList(agentId)
  return list.find((e) => e.id === id)
}

export const aiChatAdd = async (agentId: string, form: AiChatForm) => {
  const { path, list } = await aiChatListWrap(agentId)
  const id = useSnowflake().nextId()
  const now = Date.now()
  list.push({
    id: id,
    createdAt: now,
    updatedAt: now,
    name: form.content.substring(0, 10),
    form,
    top: false
  })
  // 保存记录
  await aiChatSave(agentId, path, list)
  return id
}

export const aiChatUpdate = async (agentId: string, id: string, target: Partial<AiChatItem>) => {
  const { path, list } = await aiChatListWrap(agentId)
  let index = list.findIndex((e) => e.id === id)
  if (index >= 0) {
    list[index] = {
      ...list[index],
      ...target,
      updatedAt: Date.now()
    }
    // 保存记录
    await aiChatSave(agentId, path, list)
  }
}

export const aiChatRemoveAll = async (agentId: string) => {
  const folder = buildChatFolderPath(agentId)
  await window.preload.fs.rm(folder)
}

export const aiChatRemove = async (agentId: string, id: string) => {
  const { path, list } = await aiChatListWrap(agentId)
  let index = list.findIndex((e) => e.id === id)
  if (index >= 0) {
    list.splice(index, 1)
    await aiChatSave(agentId, path, list)
    const p = buildChatChatPath(agentId, id)
    // 删除聊天记录
    await window.preload.fs.rm(p)
  }
}

export const aiChatMessagesGet = async (path: string): Promise<Array<ChatMessage>> => {
  if (window.preload.fs.existsSync(path)) {
    const a = JSON.parse(await window.preload.fs.readTextFile(path))
    return a.list
  }
  return []
}
export const aiChatMessagesSet = async (path: string, list: Array<ChatMessage>) => {
  await window.preload.fs.writeTextFile(path, JSON.stringify({ list, updatedAt: Date.now() }))
}
