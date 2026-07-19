import { AiChatForm, AiChatItem } from '@/entity/ai'
import { defineStore } from 'pinia'
import { useLog } from '@/hooks/UseLog'
import {
  aiChatAdd,
  aiChatGet,
  aiChatList,
  aiChatRemove,
  aiChatUpdate,
  useChatName
} from '@/modules/chat'


const aiChatRename = async (agentId: string, id: string) => {
  const target = await aiChatGet(agentId, id)
  if (target) {
    const name = await useChatName(target.form.content)
    await aiChatUpdate(agentId, id, { name })
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
