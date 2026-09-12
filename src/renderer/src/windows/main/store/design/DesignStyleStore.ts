import { defineStore } from 'pinia'
import {
  AiDesignStyle,
  AiDesignStyleForm,
  AiDesignStyleItem,
  buildAiDesignStyleTypography,
  buildAiDesignStyleTokens,
  normalizeDesignStyleCategory,
  normalizeDesignStyleItem,
  normalizeWhitespaceRatio
} from '@/entity'
import { DESIGN_STYLE_PRESETS } from '@/global/DesignStylePresets'
import {
  designStyleGet,
  designStyleList,
  designStyleListSave,
  designStyleRemove,
  designStyleSave
} from '@/windows/main/modules/design'
import { useLog } from '@/hooks/UseLog'
import { useSnowflake } from '@/hooks'
// 直连文件而非 '@/store'（index 会再导出本模块，经 index 会成环）
import { useAuthStore } from '@/windows/main/store/AuthStore'

export const useDesignStyleStore = defineStore('design:style', () => {
  const logger = useLog({ name: 'store:design-style' })

  /** 用户自建设计风格（index.json 轻量索引项，列表缓存） */
  const state = ref(new Array<AiDesignStyleItem>())

  /** 内置预设（isSystem） + 用户自建 + 市场下载，供列表与详情统一消费（预设在前）。
   *  断订后市场下载内容「直接不显示」（文档 5.2）：非会员过滤 source==='market'，重新订购自动恢复 */
  const all = computed<Array<AiDesignStyleItem | AiDesignStyle>>(() => {
    const marketHidden = !useAuthStore().features.extendedDesignStyles
    return [
      ...DESIGN_STYLE_PRESETS,
      ...state.value.filter((s) => !marketHidden || s.source !== 'market')
    ]
  })

  const init = async () => {
    const list = await designStyleList()
    // 旧索引数据缺渲染规范字段时兜底补齐（下次 put 自动落盘补全）
    state.value = list.map(normalizeDesignStyleItem)
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

  /** 本地用户风格（index.json）是否已有该 id（在线下载保留原 id，用于判断是否已下载） */
  const hasLocal = (id: string) => state.value.some((e) => e.id === id)

  /**
   * 读取完整风格：内置预设直接返回常量，用户风格读单条文件（列表缓存、详情不缓存，按需读盘）。
   * 旧数据缺 tokens / 配方字段时用默认值补齐，保证消费端字段完整。
   */
  const getDetail = async (id: string): Promise<AiDesignStyle | undefined> => {
    const preset = DESIGN_STYLE_PRESETS.find((e) => e.id === id)
    if (preset) return preset
    const style = await designStyleGet(id)
    if (!style) return undefined
    return {
      ...style,
      category: normalizeDesignStyleCategory(style.category),
      typography: buildAiDesignStyleTypography(style.typography),
      tokens: buildAiDesignStyleTokens(style.tokens),
      aliases: style.aliases ?? [],
      signature: style.signature ?? '',
      whitespaceRatio: normalizeWhitespaceRatio(style.whitespaceRatio),
      preferredFormats: style.preferredFormats ?? [],
      suitableFor: style.suitableFor ?? '',
      unsuitableFor: style.unsuitableFor ?? ''
    }
  }

  /**
   * 新增或更新设计风格，同步写 index.json 与单条文件，返回该风格的 id。
   * 内置预设只读：传入预设 id 时直接拒绝，不做任何写入，返回 undefined。
   * 自造免费且永久归用户（会员文档 5.3 方案 1）：写入不做会员拦截；
   * AI 工具旁路由 builtin Agent 隐藏 + AI 工具层会员 gate 兜底。
   */
  const put = async (
    form: AiDesignStyleForm,
    id?: string,
    source?: 'market'
  ): Promise<string | undefined> => {
    // 内置预设只读，拒绝写入
    if (isSystem(id)) return undefined
    const now = Date.now()
    if (id) {
      const idx = state.value.findIndex((e) => e.id === id)
      if (idx >= 0) {
        const item: AiDesignStyleItem = {
          id,
          name: form.name,
          description: form.description,
          category: form.category,
          tags: form.tags,
          colorPalette: form.colorPalette,
          typography: form.typography,
          tokens: form.tokens,
          whitespaceRatio: form.whitespaceRatio,
          source: state.value[idx].source,
          createdAt: state.value[idx].createdAt,
          updatedAt: now
        }
        const full: AiDesignStyle = { ...item, ...form, isSystem: false }
        state.value[idx] = item
        await Promise.all([designStyleSave(full), designStyleListSave(state.value)])
        return id
      }
      // 指定 id 新建（在线下载：保留服务端 id，便于去重）
      if (DESIGN_STYLE_PRESETS.some((p) => p.id === id)) return undefined
      const item: AiDesignStyleItem = {
        id,
        name: form.name,
        description: form.description,
        category: form.category,
        tags: form.tags,
        colorPalette: form.colorPalette,
        typography: form.typography,
        tokens: form.tokens,
        whitespaceRatio: form.whitespaceRatio,
        source,
        createdAt: now,
        updatedAt: now
      }
      const full: AiDesignStyle = { ...item, ...form, isSystem: false }
      state.value.push(item)
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
      typography: form.typography,
      tokens: form.tokens,
      whitespaceRatio: form.whitespaceRatio,
      createdAt: now,
      updatedAt: now
    }
    const full: AiDesignStyle = { ...item, ...form, isSystem: false }
    state.value.push(item)
    await Promise.all([designStyleSave(full), designStyleListSave(state.value)])
    return newId
  }

  const remove = async (id: string) => {
    // 内置预设只读，拒绝删除；用户自建与市场下载均可删除
    if (isSystem(id)) return
    state.value = state.value.filter((e) => e.id !== id)
    await designStyleListSave(state.value)
    await designStyleRemove(id)
  }

  return { state, all, init, isSystem, hasLocal, getById, getDetail, put, remove }
})
