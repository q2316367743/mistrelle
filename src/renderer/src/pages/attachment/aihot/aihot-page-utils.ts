// ==========================================
//  AIHOT 页面公共工具
//  约定来源：https://aihot.virxact.com/agent?tab=api
//  - category 须容忍 API 新增值：未知值原样展示
//  - story id 只取自 API 返回（links.story 末段 / neighbor.publicId），禁止构造
//  - 429/503 按 Retry-After 提示重试间隔
// ==========================================
import dayjs from 'dayjs'
import type { AihotItemView } from '@/modules/aihot'

/** 分类当前值（API 可能随时新增，未知值回退原样展示） */
export const AIHOT_CATEGORY_LABELS: Record<string, string> = {
  'ai-models': 'AI 模型',
  'ai-products': 'AI 产品',
  industry: '行业',
  paper: '论文',
  tip: '贴士'
}

export const aihotCategoryLabel = (category: string | null | undefined): string | null => {
  if (!category) return null
  return AIHOT_CATEGORY_LABELS[category] ?? category
}

/** 提取 story 链接的末段 path 作为 publicId；解析失败返回 null（此时不得构造 id） */
export const storyIdFromLink = (url?: string): string | null => {
  if (!url) return null
  try {
    const segment = new URL(url).pathname.split('/').filter(Boolean).pop()
    return segment || null
  } catch {
    return null
  }
}

/** 相对时间：x 分钟 / 小时 / 天前 */
export const aihotRelativeTime = (value?: string | null): string => {
  if (!value) return ''
  const diffMinutes = dayjs().diff(dayjs(value), 'minute')
  if (diffMinutes < 1) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} 小时前`
  return `${Math.floor(diffHours / 24)} 天前`
}

/** 绝对时间：YYYY-MM-DD HH:mm */
export const aihotDateTime = (value?: string | null): string => {
  if (!value) return ''
  return dayjs(value).format('YYYY-MM-DD HH:mm')
}

// ==========================================
//  时间轴（参考 aihot.virxact.com/all 的按日分组时间线）
// ==========================================
export interface AihotTimelineGroup {
  /** 本地时区日期键 YYYY-MM-DD */
  key: string
  /** 组标签：今天 · 8月21日 周四 / 昨天 · ... / 8月19日 周二 */
  label: string
  items: Array<AihotItemView>
}

/** 时间轴基准：timeline 用 discoveredAt，published 用 publishedAt（null 回退 discoveredAt） */
export const aihotTimelineKey = (item: AihotItemView, by: 'timeline' | 'published'): string =>
  by === 'published' ? item.publishedAt ?? item.discoveredAt : item.discoveredAt

const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 组标签：今天 / 昨天 / M月D日 周X */
export const aihotDayLabel = (key: string): string => {
  const day = dayjs(key)
  const base = `${day.month() + 1}月${day.date()}日 ${WEEK_LABELS[day.day()]}`
  const diffDays = dayjs().startOf('day').diff(day.startOf('day'), 'day')
  if (diffDays === 0) return `今天 · ${base}`
  if (diffDays === 1) return `昨天 · ${base}`
  return base
}

/** 时间轴行时间 HH:mm（本地时区） */
export const aihotTimelineTime = (item: AihotItemView, by: 'timeline' | 'published'): string =>
  dayjs(aihotTimelineKey(item, by)).format('HH:mm')

/**
 * 按本地时区日期分组：items 须先按时间倒序排好，组与组内均保持传入顺序
 */
export const groupAihotItemsByDay = (
  items: Array<AihotItemView>,
  by: 'timeline' | 'published'
): Array<AihotTimelineGroup> => {
  const groups = new Map<string, Array<AihotItemView>>()
  for (const item of items) {
    const key = dayjs(aihotTimelineKey(item, by)).format('YYYY-MM-DD')
    const list = groups.get(key)
    if (list) {
      list.push(item)
    } else {
      groups.set(key, [item])
    }
  }
  return Array.from(groups.entries()).map(([key, list]) => ({
    key,
    label: aihotDayLabel(key),
    items: list
  }))
}
