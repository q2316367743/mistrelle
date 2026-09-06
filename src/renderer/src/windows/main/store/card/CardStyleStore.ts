import { defineStore } from 'pinia'
import { AiCardStyle, AiCardStyleForm, AiCardStyleItem, normalizeCardStyleItem } from '@/entity'
import { normalizeCardStyleProps } from '@/global/card-style-props'
import { normalizeCardStyleCss, normalizeCardStyleTemplate } from '@/global/card-style-template'
import { CARD_STYLE_PRESETS } from '@/global/CardStylePresets'
import {
  cardStyleList,
  cardStyleListSave,
  cardStyleRemove,
  cardStyleSave
} from '@/windows/main/modules/card'
import { useLog } from '@/hooks/UseLog'
import { useSnowflake } from '@/hooks'
// 直连文件而非 '@/store'（index 会再导出本模块，经 index 会成环）
import { useAuthStore } from '@/windows/main/store/AuthStore'

export const useCardStyleStore = defineStore('card:style', () => {
  const logger = useLog({ name: 'store:card-style' })

  /** 用户自建卡片风格（index.json 轻量索引项，列表缓存） */
  const state = ref(new Array<AiCardStyleItem>())

  /** 内置预设（isSystem）+ 用户自建，供列表与渲染统一消费（预设在前） */
  const all = computed<Array<AiCardStyleItem | AiCardStyle>>(() => [
    ...CARD_STYLE_PRESETS,
    ...state.value
  ])

  const init = async () => {
    const list = await cardStyleList()
    // 旧索引数据缺键时按注册表兜底补齐（下次 put 自动落盘补全）
    state.value = list.map(normalizeCardStyleItem)
  }

  init()
    .then(() => logger.debug('卡片风格初始化成功'))
    .catch((e) => logger.error('卡片风格初始化失败', e))

  const isSystem = (id?: string) => {
    if (!id) return false
    const target = all.value.find((e) => e.id === id)
    return target ? 'isSystem' in target && target.isSystem : false
  }

  const getById = (id?: string): AiCardStyleItem | AiCardStyle | undefined => {
    if (!id) return undefined
    return all.value.find((e) => e.id === id)
  }

  /**
   * 新增或更新卡片风格，同步写 index.json 与单条文件，返回该风格的 id。
   * 内置预设只读：传入预设 id 时直接拒绝，不做任何写入，返回 undefined。
   * 自定义卡片风格为会员功能：非会员兜底拒绝写入（UI 入口已锁，防 AI 工具旁路）。
   */
  const put = async (form: AiCardStyleForm, id?: string): Promise<string | undefined> => {
    if (isSystem(id)) return undefined
    if (!useAuthStore().features.extendedCardStyles) return undefined
    const now = Date.now()
    const props = normalizeCardStyleProps(form.props)
    const template = normalizeCardStyleTemplate(form.template)
    const css = normalizeCardStyleCss(form.css)
    const existing = id ? state.value.findIndex((e) => e.id === id) : -1
    const item: AiCardStyleItem = {
      id: id ?? useSnowflake().nextId(),
      name: form.name,
      description: form.description,
      tags: form.tags,
      props,
      template,
      css,
      createdAt: existing >= 0 ? state.value[existing].createdAt : now,
      updatedAt: now
    }
    const full: AiCardStyle = { ...item, isSystem: false }
    if (existing >= 0) {
      state.value[existing] = item
    } else if (id && CARD_STYLE_PRESETS.some((p) => p.id === id)) {
      // 指定 id 新建时不允许撞内置预设 id
      return undefined
    } else {
      state.value.push(item)
    }
    await Promise.all([cardStyleSave(full), cardStyleListSave(state.value)])
    return item.id
  }

  const remove = async (id: string) => {
    // 内置预设只读，拒绝删除；自定义风格为会员功能，非会员兜底拒绝（UI 入口已提示）
    if (isSystem(id) || !useAuthStore().features.extendedCardStyles) return
    state.value = state.value.filter((e) => e.id !== id)
    await cardStyleListSave(state.value)
    await cardStyleRemove(id)
  }

  return { state, all, init, isSystem, getById, put, remove }
})
