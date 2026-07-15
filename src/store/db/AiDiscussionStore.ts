import { defineStore } from 'pinia'
import { AiDiscussion, AiDiscussionForm, AiDiscussionItem } from '@/entity/ai/AiDiscussion'
import {
  getFromOneByAsync,
  listByAsync,
  removeOneByAsync,
  saveListByAsync,
  saveOneByAsync
} from '@/utils/native'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { useLog } from '@/hooks/UseLog'
import { useSnowflake } from '@/hooks'

export const useAiDiscussionStore = defineStore('ai-discussion', () => {
  const logger = useLog({ name: 'ai-discussion' })
  const state = ref<Array<AiDiscussionItem>>([])
  const rev = ref<string>()

  const init = async () => {
    const res = await listByAsync(LocalNameEnum.LIST_AI_DISCUSSION)
    state.value = res.list
    rev.value = res.rev
  }

  init().then(() => logger.debug('AI 分组初始化成功'))

  const put = async (form: AiDiscussionForm, id?: string) => {
    let add = true
    let itemId: string
    const now = Date.now()
    if (id) {
      const index = state.value.findIndex((item) => item.id === id)
      if (index > -1) {
        state.value[index] = {
          ...state.value[index],
          name: form.name,
          description: form.description,
          updatedAt: now
        }
        add = false
        itemId = state.value[index].id
      } else {
        itemId = useSnowflake().nextId()
      }
    } else {
      itemId = useSnowflake().nextId()
    }
    if (add) {
      state.value.push({
        ...form,
        id: itemId,
        createdAt: now,
        updatedAt: now,
        name: form.name,
        description: form.description,
        top: false
      })
    }
    rev.value = await saveListByAsync(LocalNameEnum.LIST_AI_DISCUSSION, state.value, rev.value)
    // 更新详情
    const old = await getFromOneByAsync<AiDiscussion>(LocalNameEnum.ITEM_AI_DISCUSSION(itemId))
    await saveOneByAsync<AiDiscussion>(
      LocalNameEnum.ITEM_AI_DISCUSSION(itemId),
      {
        ...form,
        top: false,
        id: itemId,
        createdAt: now,
        updatedAt: now
      },
      old?.rev
    )
    return itemId
  }

  const getById = async (id?: string): Promise<AiDiscussion | undefined> => {
    if (!id) return undefined
    const index = state.value.findIndex((item) => item.id === id)
    if (index < 0) return undefined
    const res = await getFromOneByAsync<AiDiscussion>(LocalNameEnum.ITEM_AI_DISCUSSION(id))
    if (!res.record) return undefined
    return {
      ...res.record,
      ...state.value[index]
    }
  }

  const remove = async (id: string) => {
    const index = state.value.findIndex((item) => item.id === id)
    if (index < 0) return
    state.value.splice(index, 1)
    await saveListByAsync(LocalNameEnum.LIST_AI_DISCUSSION, state.value, rev.value)
    await removeOneByAsync(LocalNameEnum.ITEM_AI_DISCUSSION(id))
  }

  return {
    state,
    put,
    getById,
    remove
  }
})
