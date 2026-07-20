import { defineStore } from 'pinia'
import { AiModel, AiModelType, AiProvide, AiProvideForm } from '@/entity'
import { listByAsync, saveListByAsync } from '@/utils/native/DbStorageUtil'
import { useSnowflake } from '@/hooks'
import { SelectOptionGroup } from 'tdesign-vue-next'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { cloneDeep } from 'es-toolkit'

export interface AiProvideOption extends AiModel {
  provideId: string
  // 提供方名称
  baseUrl: string
  // 提供方密钥
  key: string
}

const handleModelOption = (
  items: Array<AiProvide>,
  type: AiModelType
): Array<SelectOptionGroup> => {
  const list = new Array<SelectOptionGroup>()
  for (const item of items) {
    const models = item.models
      .filter((model) => model.enable && model.type === type)
      .map((model) => ({
        label: model.model,
        value: `${item.id}:${model.identifier}`
      }))
    if (models.length > 0) {
      list.push({
        group: item.name,
        children: models
      })
    }
  }
  return list
}

export const useSettingAiStore = defineStore('AiProvideStore', () => {
  const items = ref(new Array<AiProvide>())
  const rev = ref<string>()

  const options = computed<Array<SelectOptionGroup>>(() => {
    return handleModelOption(items.value, 'chat')
  })
  const vectorOptions = computed<Array<SelectOptionGroup>>(() => {
    return handleModelOption(items.value, 'vector')
  })

  const optionMap = computed<Map<string, AiProvideOption>>(() => {
    const map = new Map<string, AiProvideOption>()
    items.value.forEach((item) =>
      item.models
        .filter((model) => model.enable)
        .forEach((model) => {
          map.set(`${item.id}:${model.identifier}`, {
            ...model,
            ...item,
            provideId: item.id
          })
        })
    )
    return map
  })

  const init = async () => {
    const res = await listByAsync<AiProvide>(LocalNameEnum.SETTING_AI)
    items.value = res.list.map((item) => ({
      ...item,
      models: item.models.map((model) => ({
        ...model,
        enable: model.enable ?? true
      }))
    }))
    rev.value = res.rev
  }

  init()

  const put = async (form: AiProvideForm) => {
    const index = form.id ? items.value.findIndex((item) => item.id === form.id) : -1
    if (index > -1) {
      items.value[index] = {
        ...items.value[index],
        ...form,
        updatedAt: Date.now()
      }
    } else {
      items.value.push({
        ...form,
        id: useSnowflake().nextId(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    }
    rev.value = await saveListByAsync(LocalNameEnum.SETTING_AI, cloneDeep(items.value), rev.value)
  }

  const remove = async (id: string) => {
    const index = items.value.findIndex((item) => item.id === id)
    if (index === -1) return
    items.value.splice(index, 1)
    rev.value = await saveListByAsync(LocalNameEnum.SETTING_AI, items.value, rev.value)
  }

  return {
    items,
    options,
    vectorOptions,
    optionMap,
    put,
    remove
  }
})
