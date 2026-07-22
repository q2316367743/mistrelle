import { AiChatContent, AiChatDraft, AiChatItem } from '@/entity/ai'
import { useSnowflake } from '@/hooks'
import { getAppData2Chat } from '@/global/Constant'
import { ChatMessage, TextContent, UserMessageContent } from '@/domain'

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

const aiChatSave = async (agentId: string, path: string, list: Array<AiChatItem>) => {
  await window.preload.fs.writeTextFile(path, JSON.stringify(list))
  aiChatCacheMap.set(agentId, { path, list })
}

/**
 * 从 content 中提取首条消息预览文本
 */
const buildPreviewText = (content: UserMessageContent[]): string =>
  content
    .filter((c): c is TextContent => c.type === 'text')
    .map((c) => c.data)
    .join('')

/**
 * 迁移旧格式：index.json 中的 form 字段拆分为 preview / previewModel。
 * 对未打开过的旧聊天，把 form 内容写入 chat.json 作为 draft。
 */
const migrateOldItem = async (agentId: string, item: unknown): Promise<AiChatItem> => {
  const raw = item as Record<string, unknown>
  if (!raw.form || typeof raw.form !== 'object') return raw as unknown as AiChatItem

  const oldForm = raw.form as {
    content?: string
    model?: string
    thinking?: 'enabled' | 'disabled'
    reasoning_effort?: 'high' | 'max'
  }
  const preview = oldForm.content ?? ''
  const previewModel = oldForm.model ?? ''
  const modelParts = previewModel.split(':')

  const newItem: AiChatItem = {
    id: raw.id as string,
    name: (raw.name as string) || preview.slice(0, 10),
    top: !!raw.top,
    createdAt: raw.createdAt as number,
    updatedAt: raw.updatedAt as number,
    preview,
    previewModel
  }

  // 若 chat.json 尚不存在，把旧 form 作为 draft 写进去，避免未发送的首条消息丢失
  const chatPath = buildChatChatPath(agentId, newItem.id)
  if (!window.preload.fs.existsSync(chatPath) && modelParts.length >= 2) {
    const content: UserMessageContent[] = preview
      ? [
          {
            type: 'text',
            data: preview,
            status: 'complete',
            time: Date.now()
          }
        ]
      : []
    const draft: AiChatDraft = {
      content,
      model: modelParts.slice(1).join(':'),
      provide: modelParts[0],
      thinking: oldForm.thinking,
      reasoning_effort: oldForm.reasoning_effort
    }
    await aiChatContentSet(chatPath, {
      updatedTime: newItem.createdAt,
      systemPrompt: '',
      draft,
      messages: []
    })
  }

  return newItem
}

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

/**
 * 获取聊天列表
 * @param agentId 分组 ID
 */
export const aiChatList = async (agentId: string): Promise<Array<AiChatItem>> => {
  const cache = aiChatCacheMap.get(agentId)
  if (cache) return cache.list
  const ca = await aiChatListWrap(agentId)
  const migrated = await Promise.all(ca.list.map((item) => migrateOldItem(agentId, item)))
  const hasChange = migrated.some((item, index) => item !== ca.list[index])
  if (hasChange) {
    ca.list = migrated
    await aiChatSave(agentId, ca.path, migrated)
  }
  aiChatCacheMap.set(agentId, ca)
  return migrated
}

export const aiChatGet = async (agentId: string, id: string): Promise<AiChatItem | undefined> => {
  const list = await aiChatList(agentId)
  return list.find((e) => e.id === id)
}

export const aiChatAdd = async (agentId: string, draft: AiChatDraft, systemPrompt: string) => {
  const { path, list } = await aiChatListWrap(agentId)
  const id = useSnowflake().nextId()
  const now = Date.now()
  const preview = buildPreviewText(draft.content)
  const item: AiChatItem = {
    id,
    createdAt: now,
    updatedAt: now,
    name: preview.slice(0, 10),
    top: false,
    preview,
    previewModel: `${draft.provide}:${draft.model}`
  }
  list.push(item)
  // 保存索引
  await aiChatSave(agentId, path, list)
  // 保存聊天内容（含草稿）
  await aiChatContentSet(buildChatChatPath(agentId, id), {
    updatedTime: now,
    systemPrompt,
    draft,
    messages: []
  })
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

/**
 * 读取完整聊天内容（含 draft 与 messages），兼容旧格式 { list: ChatMessage[] }
 */
export const aiChatContentGet = async (path: string): Promise<AiChatContent | undefined> => {
  if (!window.preload.fs.existsSync(path)) return undefined
  try {
    const data = JSON.parse(await window.preload.fs.readTextFile(path))
    if (Array.isArray(data.list)) {
      return {
        updatedTime: data.updatedAt || Date.now(),
        systemPrompt: '',
        messages: data.list as ChatMessage[]
      }
    }
    return data as AiChatContent
  } catch {
    return undefined
  }
}

/**
 * 写入完整聊天内容
 */
export const aiChatContentSet = async (path: string, content: AiChatContent) => {
  await window.preload.fs.writeTextFile(path, JSON.stringify(content))
}
