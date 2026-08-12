import { AiChatContent } from '@/entity/ai'
import {
  aiChatContentGet,
  aiChatContentSet,
  buildChatMainPath,
  buildChatSubPath
} from '@/modules/chat/service/ChatService'
import { ChatMessage } from '@/domain'

/**
 * 子 Agent 消息持久化到 message/sub_{subId}.json，复用 AiChatContent 结构。
 */
export const persistSubAgent = async (
  storageKey: string,
  messages: ChatMessage[]
): Promise<void> => {
  const content: AiChatContent = {
    updatedTime: Date.now(),
    draft: undefined,
    agentId: '',
    workspace: '',
    mode: 0,
    messages: toRaw(messages)
  }
  await aiChatContentSet(storageKey, content)
}

/**
 * 读取单个子 Agent 的完整消息内容（供 UI 展示子 Agent 执行过程）。
 */
export const readSubAgentContent = async (
  chatId: string,
  subId: string
): Promise<ChatMessage[] | undefined> => {
  const path = buildChatSubPath(chatId, subId)
  const content = await aiChatContentGet(path)
  return content?.messages
}

/**
 * 读取主 Agent 消息文件（供 UI 加载主聊天记录）。
 */
export const readMainContent = async (chatId: string): Promise<AiChatContent | undefined> => {
  return aiChatContentGet(buildChatMainPath(chatId))
}
