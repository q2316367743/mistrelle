import { AiChatContent, AiChatItem } from '@/entity/ai'
import { getAppData2Chat } from '@/global/Constant'
import { ChatMessage } from '@/domain'

let chatIndexPath: string | undefined = undefined

const buildChatIndexPath = (folder?: string) => {
  if (chatIndexPath) return chatIndexPath
  const c = window.preload.path.join(folder || getAppData2Chat(), 'index.json')
  chatIndexPath = c
  return c
}

export const buildChatChatPath = (id: string, folder?: string) =>
  window.preload.path.join(folder || getAppData2Chat(), id + '.json')

/**
 * 保存聊天列表
 * @param list 聊天列表
 */
export const aiChatIndexSave = async (list: Array<AiChatItem>) => {
  await window.preload.fs.writeTextFile(buildChatIndexPath(), JSON.stringify(list))
}

/**
 * 写入完整聊天内容
 */
export const aiChatContentSet = async (path: string, content: AiChatContent) => {
  await window.preload.fs.writeTextFile(path, JSON.stringify(content))
}

/**
 * 获取聊天列表
 */
export const aiChatList = async (): Promise<Array<AiChatItem>> => {
  const folder = getAppData2Chat()
  const indexPath = buildChatIndexPath(folder)
  if (!window.preload.fs.existsSync(folder)) {
    // 创建目录
    await window.preload.fs.mkdir(folder)
    // 创建默认索引文件
    await window.preload.fs.writeTextFile(indexPath, JSON.stringify([]))
    return []
  }
  if (!window.preload.fs.existsSync(indexPath)) {
    // 写入默认数组
    await window.preload.fs.writeTextFile(indexPath, JSON.stringify([]))
    return []
  }
  const text = await window.preload.fs.readTextFile(indexPath)
  return JSON.parse(text)
}

export const aiChatGet = async (id: string): Promise<AiChatItem | undefined> => {
  const list = await aiChatList()
  return list.find((e) => e.id === id)
}

export const aiChatRemove = async (id: string) => {
  const p = buildChatChatPath(id)
  // 删除聊天记录
  await window.preload.fs.rm(p)
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
