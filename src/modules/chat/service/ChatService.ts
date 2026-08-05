import { AiChatContent, AiChatItem } from '@/entity/ai'
import { getChatIndexPath, getChatMessageDir, getDataForWorkspace } from '@/global/Constant'
import { ChatMessage } from '@/domain'
import type { ChatType, WritingScene } from '@/modules/chat'

let chatIndexPath: string | undefined = undefined

const buildChatIndexPath = () => {
  if (chatIndexPath) return chatIndexPath
  chatIndexPath = getChatIndexPath()
  return chatIndexPath
}

/**
 * 主 Agent 消息文件路径：~/.mistrelle/workspace/{chatId}/message/main.json
 */
export const buildChatMainPath = (chatId: string) =>
  window.preload.path.join(getChatMessageDir(chatId), 'main.json')

/**
 * 子 Agent 消息文件路径：~/.mistrelle/workspace/{chatId}/message/sub_{subId}.json
 */
export const buildChatSubPath = (chatId: string, subId: string) =>
  window.preload.path.join(getChatMessageDir(chatId), `sub_${subId}.json`)

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

/** 沙盒目录创建选项：按聊天类型 / 写作子场景预建专属目录结构 */
export interface ChatSandboxOptions {
  /** 聊天类型：writing 场景额外预建文章项目目录 */
  type?: ChatType
  /** 写作子场景：article 时预建 articles/{drafts,assets} */
  writingScene?: WritingScene
}

// 创建此次聊天的沙盒目录（含 message/ 子目录）
export const aiChatSandbox = async (id: string, options: ChatSandboxOptions = {}) => {
  const folder = window.preload.path.join(getDataForWorkspace(), id)
  await window.preload.fs.mkdir(folder, true)
  const outputs = window.preload.path.join(folder, 'outputs')
  const inputs = window.preload.path.join(folder, 'inputs')
  const tmp = window.preload.path.join(folder, 'tmp')
  const message = window.preload.path.join(folder, 'message')
  await Promise.all([
    window.preload.fs.mkdir(outputs),
    window.preload.fs.mkdir(inputs),
    window.preload.fs.mkdir(tmp),
    window.preload.fs.mkdir(message)
  ])
  // writing / article 场景：预建文章项目目录（drafts 正文 + assets 配图），供 AI 与侧边栏直接使用
  if (options.type === 'writing' && options.writingScene === 'article') {
    const articles = window.preload.path.join(outputs, 'articles')
    await window.preload.fs.mkdir(articles, true)
    await Promise.all([
      window.preload.fs.mkdir(window.preload.path.join(articles, 'drafts')),
      window.preload.fs.mkdir(window.preload.path.join(articles, 'assets'))
    ])
  }
}

export const getSandboxDir = (id: string) => window.preload.path.join(getDataForWorkspace(), id)

/**
 * 获取聊天列表
 */
export const aiChatList = async (): Promise<Array<AiChatItem>> => {
  const folder = getDataForWorkspace()
  const indexPath = buildChatIndexPath()
  if (!window.preload.fs.existsSync(folder)) {
    await window.preload.fs.mkdir(folder)
    await window.preload.fs.writeTextFile(indexPath, JSON.stringify([]))
    return []
  }
  if (!window.preload.fs.existsSync(indexPath)) {
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
  const p = buildChatMainPath(id)
  // 删除主 Agent 聊天记录文件
  await window.preload.fs.rm(p)
}

// 删除该聊天的沙盒目录（含 message/ 子目录及全部子 Agent 文件）
export const aiChatSandboxRemove = async (id: string) => {
  const folder = getSandboxDir(id)
  if (window.preload.fs.existsSync(folder)) {
    await window.preload.fs.rm(folder)
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
        agentId: '',
        workspace: '',
        updatedTime: data.updatedAt || Date.now(),
        messages: data.list as ChatMessage[],
        mode: 0
      }
    }
    return data as AiChatContent
  } catch {
    return undefined
  }
}
