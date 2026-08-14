import { defineStore } from 'pinia'
import { AiModel, AiModelType, AiProvide, AiProvideFormat, AiProvideForm } from '@/entity'
import { useSnowflake } from '@/hooks'
import { SelectOptionGroup } from 'tdesign-vue-next'
import { modelList, modelSave } from '@/modules/setting/service/ModelService'

export interface AiProvideOption extends AiModel {
  provideId: string
  // 提供方名称
  baseUrl: string
  // 提供方密钥
  key: string
  // API 格式（chat / responses / anthropic），缺省 chat
  format?: AiProvideFormat
}

export const handleModelOption = (
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
  const ready = ref(false)
  let initPromise: Promise<void> | undefined

  const options = computed<Array<SelectOptionGroup>>(() => {
    return handleModelOption(items.value, 'chat')
  })
  const vectorOptions = computed<Array<SelectOptionGroup>>(() => {
    return handleModelOption(items.value, 'vector')
  })
  const imageOptions = computed<Array<SelectOptionGroup>>(() => {
    return handleModelOption(items.value, 'image')
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
    items.value = (await modelList()).map((item) => ({
      ...item,
      models: item.models.map((model) => ({
        ...model,
        enable: model.enable ?? true
      }))
    }))
    ready.value = true
  }

  // eslint-disable-next-line prefer-const
  initPromise = init()

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
    await modelSave(items.value)
  }

  const remove = async (id: string) => {
    const index = items.value.findIndex((item) => item.id === id)
    if (index === -1) return
    items.value.splice(index, 1)
    await modelSave(items.value)
  }

  return {
    items,
    options,
    vectorOptions,
    imageOptions,
    optionMap,
    ready,
    initPromise,
    put,
    remove
  }
})
