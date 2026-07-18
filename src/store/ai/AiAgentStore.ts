import { defineStore } from 'pinia'
import { AiAgent, AiAgentForm } from '@/entity/ai'
import { listByAsync, saveListByAsync } from '@/utils/native'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { useLog } from '@/hooks/UseLog'
import { useSnowflake } from '@/hooks'
import { aiChatRemoveAll } from '@/store'

export const useAiAgentStore = defineStore('ai-agent', () => {
  const logger = useLog({ name: 'store:ai-agent' })

  const state = ref(new Array<AiAgent>())
  const rev = ref<string>()

  const init = async () => {
    const res = await listByAsync<AiAgent>(LocalNameEnum.LIST_AI_AGENT)
    state.value = res.list
    rev.value = res.rev
  }

  init().then(() => logger.debug('AI 分组初始化成功'))

  const put = async (form: AiAgentForm, id?: string) => {
    let add = true
    if (id) {
      const index = state.value.findIndex((item) => item.id === id)
      if (index > -1) {
        state.value[index] = {
          ...state.value[index],
          ...form,
          updatedAt: Date.now()
        }
        add = false
      }
    }
    if (add) {
      state.value.push({
        ...form,
        id: useSnowflake().nextId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        top: false
      })
    }
    rev.value = await saveListByAsync(LocalNameEnum.LIST_AI_AGENT, state.value, rev.value)
  }

  const remove = async (id: string) => {
    state.value = state.value.filter((item) => item.id !== id)
    rev.value = await saveListByAsync(LocalNameEnum.LIST_AI_AGENT, state.value, rev.value)
    // 删除全部的聊天记录
    await aiChatRemoveAll(id)
  }

  const getById = (id?: string): AiAgent | undefined => {
    if (!id) return undefined
    return state.value.find((item) => item.id === id)
  }

  return {
    state,
    put,
    remove,
    getById
  }
})
