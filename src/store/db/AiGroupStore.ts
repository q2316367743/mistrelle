import { defineStore } from 'pinia'
import { AiGroup, AiGroupForm } from '@/entity/ai'
import { listByAsync, saveListByAsync } from '@/utils/native'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { useLog } from '@/hooks/UseLog'
import { useSnowflake } from '@/hooks'

export const useAiGroupStore = defineStore('ai-group', () => {
  const logger = useLog({ name: 'ai-group' })

  const state = ref(new Array<AiGroup>())
  const rev = ref<string>()

  const init = async () => {
    const res = await listByAsync<AiGroup>(LocalNameEnum.LIST_AI_GROUP)
    state.value = res.list
    rev.value = res.rev
  }

  init().then(() => logger.debug('AI 分组初始化成功'))

  const put = async (form: AiGroupForm, id?: string) => {
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
    rev.value = await saveListByAsync(LocalNameEnum.LIST_AI_GROUP, state.value, rev.value)
  }

  const remove = async (id: string) => {
    state.value = state.value.filter((item) => item.id !== id)
    rev.value = await saveListByAsync(LocalNameEnum.LIST_AI_GROUP, state.value, rev.value)
  }

  const getById = (id?: string): AiGroup | undefined => {
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
