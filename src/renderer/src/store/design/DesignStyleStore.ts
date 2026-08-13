import { defineStore } from 'pinia'
import {
  AiDesignStyle,
  AiDesignStyleForm,
  AiDesignStyleItem,
  buildAiDesignStyleTokens
} from '@/entity'
import { DESIGN_STYLE_PRESETS } from '@/global/DesignStylePresets'
import {
  designStyleGet,
  designStyleList,
  designStyleListSave,
  designStyleRemove,
  designStyleSave
} from '@/modules/design'
import { useLog } from '@/hooks/UseLog'
import { useSnowflake } from '@/hooks'

export const useDesignStyleStore = defineStore('design:style', () => {
  const logger = useLog({ name: 'store:design-style' })

  /** 用户自建设计风格（index.json 轻量索引项，列表缓存） */
  const state = ref(new Array<AiDesignStyleItem>())

  /** 内置预设（isSystem） + 用户自建，供列表与详情统一消费（预设在前） */
  const all = computed<Array<AiDesignStyleItem | AiDesignStyle>>(() => [
    ...DESIGN_STYLE_PRESETS,
    ...state.value
  ])

  const init = async () => {
    state.value = await designStyleList()
  }

  init()
    .then(() => logger.debug('设计风格初始化成功'))
    .catch((e) => logger.error('设计风格初始化失败', e))

  const isSystem = (id?: string) => {
    if (!id) return false
    const target = all.value.find((e) => e.id === id)
    return target ? 'isSystem' in target && target.isSystem : false
  }

  const getById = (id?: string): AiDesignStyleItem | AiDesignStyle | undefined => {
    if (!id) return undefined
    return all.value.find((e) => e.id === id)
  }

  /**
   * 读取完整风格：内置预设直接返回常量，用户风格读单条文件（列表缓存、详情不缓存，按需读盘）。
   * 旧数据缺 tokens 字段时用默认值补齐，保证消费端（明细页 / 提示词 / 编辑表单）字段完整。
   */
  const getDetail = async (id: string): Promise<AiDesignStyle | undefined> => {
    const preset = DESIGN_STYLE_PRESETS.find((e) => e.id === id)
    if (preset) return preset
    const style = await designStyleGet(id)
    return style ? { ...style, tokens: buildAiDesignStyleTokens(style.tokens) } : undefined
  }

  /**
   * 新增或更新设计风格，同步写 index.json 与单条文件，返回该风格的 id。
   * 内置预设只读：传入预设 id 时直接拒绝，不做任何写入，返回 undefined。
   */
  const put = async (form: AiDesignStyleForm, id?: string): Promise<string | undefined> => {
    // 内置预设只读，拒绝写入
    if (isSystem(id)) return undefined
    const now = Date.now()
    if (id) {
      const idx = state.value.findIndex((e) => e.id === id)
      if (idx < 0) return undefined
      const item: AiDesignStyleItem = {
        id,
        name: form.name,
        description: form.description,
        category: form.category,
        tags: form.tags,
        colorPalette: form.colorPalette,
        createdAt: state.value[idx].createdAt,
        updatedAt: now
      }
      const full: AiDesignStyle = { ...item, ...form, isSystem: false }
      state.value[idx] = item
      await Promise.all([designStyleSave(full), designStyleListSave(state.value)])
      return id
    }
    const newId = useSnowflake().nextId()
    const item: AiDesignStyleItem = {
      id: newId,
      name: form.name,
      description: form.description,
      category: form.category,
      tags: form.tags,
      colorPalette: form.colorPalette,
      createdAt: now,
      updatedAt: now
    }
    const full: AiDesignStyle = { ...item, ...form, isSystem: false }
    state.value.push(item)
    await Promise.all([designStyleSave(full), designStyleListSave(state.value)])
    return newId
  }

  const remove = async (id: string) => {
    // 内置预设只读，拒绝删除
    if (isSystem(id)) return
    state.value = state.value.filter((e) => e.id !== id)
    await designStyleListSave(state.value)
    await designStyleRemove(id)
  }

  return { state, all, init, isSystem, getById, getDetail, put, remove }
})
