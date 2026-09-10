import { defineStore } from 'pinia'
import { AiModel, AiModelType, AiProvide, AiProvideFormat, AiProvideForm } from '@/entity'
import { useSnowflake } from '@/hooks'
import { SelectOptionGroup } from 'tdesign-vue-next'
import { modelList, modelSave } from '@/windows/main/modules/setting/service/ModelService'
import { listRelayModels } from '@/windows/main/modules/ai'
import { useAuthStore } from '@/windows/main/store/AuthStore'

/** 内置供应商（服务端中转站）固定 id：运行时注入 items 首项，不落盘 model.json */
export const BUILTIN_PROVIDER_ID = 'builtin'

/** 内置供应商显示名 */
export const BUILTIN_PROVIDER_NAME = 'Mistrelle 内置'

export interface AiProvideOption extends AiModel {
  provideId: string
  // 提供方名称
  baseUrl: string
  // 提供方密钥
  key: string
  // API 格式（chat / responses / anthropic），缺省 chat
  format?: AiProvideFormat
  // 内置供应商（服务端中转站）标记：请求走主进程 relay IPC
  builtin?: boolean
}

/** 构建内置供应商（服务端中转站）：enable 恒 true、baseUrl/key 占位（请求由主进程注入） */
function buildBuiltinProvider(models: AiModel[] = []): AiProvide {
  return {
    id: BUILTIN_PROVIDER_ID,
    name: BUILTIN_PROVIDER_NAME,
    baseUrl: 'builtin://relay',
    key: '',
    models,
    enable: true,
    format: 'chat',
    builtin: true,
    createdAt: 0,
    updatedAt: 0
  }
}

export const handleModelOption = (
  items: Array<AiProvide>,
  type: AiModelType
): Array<SelectOptionGroup> => {
  const list = new Array<SelectOptionGroup>()
  for (const item of items) {
    if (!item.enable) continue
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
  /** 内置模型拉取中（刷新按钮 loading） */
  const refreshingBuiltin = ref(false)
  let initPromise: Promise<void> | undefined

  /**
   * 门控：免费档（未登录 / unknown / 已登录无会员）只提供内置供应商。
   * thirdPartyRelay 已消费（docs/auth/02），消费点只读 AuthStore.features。
   */
  const relayEnabled = computed(() => useAuthStore().features.thirdPartyRelay)

  /** 提供给外部的提供方列表：内置恒在首项；免费档过滤掉自定义（不可见不可选） */
  const visibleItems = computed<AiProvide[]>(() => {
    const base = items.value
    return relayEnabled.value ? base : base.filter((item) => item.builtin)
  })

  const options = computed<Array<SelectOptionGroup>>(() => {
    return handleModelOption(visibleItems.value, 'chat')
  })
  const vectorOptions = computed<Array<SelectOptionGroup>>(() => {
    return handleModelOption(visibleItems.value, 'vector')
  })

  const optionMap = computed<Map<string, AiProvideOption>>(() => {
    const map = new Map<string, AiProvideOption>()
    visibleItems.value.forEach((item) => {
      if (!item.enable) return
      item.models
        .filter((model) => model.enable)
        .forEach((model) => {
          map.set(`${item.id}:${model.identifier}`, {
            ...model,
            ...item,
            provideId: item.id
          })
        })
    })
    return map
  })

  /** 拉取内置供应商模型列表（登录后调用；未登录抛错由调用方提示） */
  const refreshBuiltinModels = async (): Promise<void> => {
    refreshingBuiltin.value = true
    try {
      const fetched = await listRelayModels()
      const index = items.value.findIndex((item) => item.builtin)
      if (index > -1) {
        items.value[index] = {
          ...items.value[index],
          models: fetched.map((m) => ({
            identifier: m.id,
            model: m.id,
            enable: true,
            type: 'chat' as AiModelType
          }))
        }
      }
    } finally {
      refreshingBuiltin.value = false
    }
  }

  const init = async () => {
    const custom = (await modelList()).map((item) => ({
      ...item,
      enable: item.enable ?? true,
      models: item.models.map((model) => ({
        ...model,
        enable: model.enable ?? true
      }))
    }))
    items.value = [buildBuiltinProvider(), ...custom]
    ready.value = true
    // 登录态变化（含启动后首拉）：已登录拉内置模型列表，未登录内置模型保持空
    const authStore = useAuthStore()
    const syncBuiltin = async (): Promise<void> => {
      if (authStore.status === 'signed-in') {
        try {
          await refreshBuiltinModels()
        } catch (error) {
          console.error('[ai-store] 拉取内置模型失败', error)
        }
      }
    }
    if (authStore.status === 'signed-in') {
      void syncBuiltin()
    }
    window.preload.auth.onChanged(() => {
      void syncBuiltin()
    })
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
    if (id === BUILTIN_PROVIDER_ID) return
    const index = items.value.findIndex((item) => item.id === id)
    if (index === -1) return
    items.value.splice(index, 1)
    await modelSave(items.value)
  }

  const reorder = async (from: number, to: number) => {
    if (from === to) return
    const list = items.value.slice()
    if (from < 0 || to < 0 || from >= list.length || to >= list.length) return
    const [moved] = list.splice(from, 1)
    if (!moved) return
    list.splice(to, 0, moved)
    items.value = list
    await modelSave(items.value)
  }

  return {
    items,
    visibleItems,
    options,
    vectorOptions,
    optionMap,
    ready,
    initPromise,
    refreshingBuiltin,
    relayEnabled,
    refreshBuiltinModels,
    put,
    remove,
    reorder
  }
})
