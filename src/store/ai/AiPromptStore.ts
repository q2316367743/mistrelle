import { defineStore } from 'pinia'
import { AiPrompt, AiPromptForm, AiPromptItem } from '@/entity/ai'
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

export const useAiPromptStore = defineStore('ai-prompt', () => {
  const logger = useLog({ name: 'store:ai-prompt' })
  const state = ref(new Array<AiPromptItem>())
  const rev = ref<string>()

  ;(async () => {
    const res = await listByAsync<AiPromptItem>(LocalNameEnum.LIST_AI_PROMPT)
    state.value = res.list
    rev.value = res.rev
  })()
    .then(() => logger.debug('AI 提示词初始化成功'))
    .catch((e) => logger.error('AI 提示词初始化失败', e))

  const getById = async (id: string): Promise<AiPrompt | undefined> => {
    const item = state.value.find((item) => item.id === id)
    if (!item) return undefined
    const content = await getFromOneByAsync<AiPrompt>(LocalNameEnum.ITEM_AI_PROMPT(id))
    if (!content.record) return undefined
    return {
      ...content.record,
      ...item
    }
  }

  const put = async (form: AiPromptForm, id?: string) => {
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
        description: form.description
      })
    }
    rev.value = await saveListByAsync(LocalNameEnum.LIST_AI_PROMPT, state.value, rev.value)
    // 更新详情
    const old = await getFromOneByAsync<AiPrompt>(LocalNameEnum.ITEM_AI_PROMPT(itemId))
    await saveOneByAsync<AiPrompt>(
      LocalNameEnum.ITEM_AI_PROMPT(itemId),
      {
        ...form,
        id: itemId,
        createdAt: now,
        updatedAt: now
      },
      old?.rev
    )
    return itemId
  }

  const remove = async (id: string) => {
    const index = state.value.findIndex((item) => item.id === id)
    if (index < 0) return
    state.value.splice(index, 1)
    await saveListByAsync(LocalNameEnum.LIST_AI_PROMPT, state.value, rev.value)
    await removeOneByAsync(LocalNameEnum.ITEM_AI_PROMPT(id))
  }

  return { state, getById, put, remove }
})
