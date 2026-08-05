import { defineStore } from 'pinia'
import { AiWorkspace, AiWorkspaceForm } from '@/entity'
import { useLog } from '@/hooks/UseLog'
import { listByAsync, saveListByAsync } from '@/utils/native'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { useSnowflake } from '@/hooks'

export const useAiWorkspaceStore = defineStore('ai:workspace', () => {
  const logger = useLog({ name: 'store:ai-workspace' })

  const state = ref(new Array<AiWorkspace>())
  const rev = ref<string>()

  ;(async () => {
    const res = await listByAsync<AiWorkspace>(LocalNameEnum.LIST_AI_WORKSPACE)
    state.value = res.list
    rev.value = res.rev
  })()
    .then(() => logger.debug('AI 工作空间初始化成功'))
    .catch((e) => logger.error('AI 工作空间初始化失败', e))

  const put = async (form: AiWorkspaceForm, id?: string) => {
    const index = id ? state.value.findIndex((item) => item.id === id) : -1
    const now = Date.now()
    if (index > -1) {
      state.value[index] = {
        ...state.value[index],
        ...form,
        updatedAt: now
      }
    } else {
      state.value.push({
        ...form,
        id: useSnowflake().nextId(),
        createdAt: now,
        updatedAt: now
      })
    }
    rev.value = await saveListByAsync(LocalNameEnum.LIST_AI_WORKSPACE, state.value, rev.value)
  }

  const remove = async (id: string) => {
    const index = state.value.findIndex((item) => item.id === id)
    if (index > -1) {
      state.value.splice(index, 1)
      rev.value = await saveListByAsync(LocalNameEnum.LIST_AI_WORKSPACE, state.value, rev.value)
    }
  }

  return {
    state,
    put,
    remove
  }
})
