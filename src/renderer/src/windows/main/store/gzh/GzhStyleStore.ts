import { defineStore } from 'pinia'
import {
  GZH_STYLE_ELEMENT_KEYS,
  type GzhStyle,
  type GzhStyleForm,
  type GzhStyleItem
} from '@/windows/main/modules/gzh/gzhTypes'
import { GZH_LAYOUT_PRESETS } from '@/windows/main/modules/gzh/gzhStylePresets'
import {
  gzhStyleList,
  gzhStyleListSave,
  gzhStyleRemove,
  gzhStyleSave
} from '@/windows/main/modules/gzh/gzhStyleService'
import { useLog } from '@/hooks/UseLog'
import { useSnowflake } from '@/hooks'

/** styles 白名单过滤：非法键剔除、值归一为非空字符串 */
export const normalizeGzhStyleMap = (
  styles: Record<string, unknown> | undefined
): Record<string, string> => {
  const result: Record<string, string> = {}
  if (!styles) return result
  for (const key of GZH_STYLE_ELEMENT_KEYS) {
    const value = styles[key]
    if (typeof value === 'string' && value.trim()) result[key] = value.trim()
  }
  return result
}

export const useGzhStyleStore = defineStore('gzh:style', () => {
  const logger = useLog({ name: 'store:gzh-style' })

  /** 用户自建排版风格（含完整 styles，随 index.json 落盘） */
  const state = ref(new Array<GzhStyleItem>())

  /** 内置预设（isSystem）+ 用户自建，供排版页下拉与渲染统一消费（预设在前） */
  const all = computed<Array<GzhStyleItem | GzhStyle>>(() => [
    ...GZH_LAYOUT_PRESETS,
    ...state.value
  ])

  const init = async () => {
    state.value = await gzhStyleList()
  }

  init()
    .then(() => logger.debug('公众号排版风格初始化成功'))
    .catch((e) => logger.error('公众号排版风格初始化失败', e))

  const isSystem = (id?: string) => {
    if (!id) return false
    const target = all.value.find((e) => e.id === id)
    return target ? 'isSystem' in target && target.isSystem : false
  }

  const getById = (id?: string): GzhStyleItem | GzhStyle | undefined => {
    if (!id) return undefined
    return all.value.find((e) => e.id === id)
  }

  /**
   * 新增或更新排版风格，同步写 index.json 与单条文件，返回该风格的 id。
   * 内置预设只读：传入预设 id 时直接拒绝，返回 undefined。
   */
  const put = async (form: GzhStyleForm, id?: string): Promise<string | undefined> => {
    if (isSystem(id)) return undefined
    const now = Date.now()
    const styles = normalizeGzhStyleMap(form.styles)
    const existing = id ? state.value.findIndex((e) => e.id === id) : -1
    const item: GzhStyleItem = {
      id: id ?? useSnowflake().nextId(),
      name: form.name,
      description: form.description,
      styles,
      createdAt: existing >= 0 ? state.value[existing].createdAt : now,
      updatedAt: now
    }
    const full: GzhStyle = { ...item, isSystem: false }
    if (existing >= 0) {
      state.value[existing] = item
    } else if (id && GZH_LAYOUT_PRESETS.some((p) => p.id === id)) {
      // 指定 id 新建时不允许撞内置预设 id
      return undefined
    } else {
      state.value.push(item)
    }
    await Promise.all([gzhStyleSave(full), gzhStyleListSave(state.value)])
    return item.id
  }

  const remove = async (id: string) => {
    if (isSystem(id)) return
    state.value = state.value.filter((e) => e.id !== id)
    await gzhStyleListSave(state.value)
    await gzhStyleRemove(id)
  }

  return { state, all, init, isSystem, getById, put, remove }
})
