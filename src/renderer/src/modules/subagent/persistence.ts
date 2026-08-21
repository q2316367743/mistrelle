import { AiChatContent } from '@/entity/ai'
import { aiChatContentGet, aiChatContentSet, buildChatSubKey } from '@/modules/chat/service/ChatService'
import { ChatMessage } from '@/domain'

/**
 * 子 Agent 消息持久化（storageKey = sub:{chatId}:{subId}，DB chat_sub 表），
 * 复用 AiChatContent 结构。
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
  const content = await aiChatContentGet(buildChatSubKey(chatId, subId))
  return content?.messages
}