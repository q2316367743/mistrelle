import type { SubscribeStatus } from '@/entity/project/Subscribe'
import type { CommonSelect } from '@/domain'

export type SubscribeTagTheme = 'default' | 'primary' | 'warning' | 'danger' | 'success'

/**
 * 单次同步最多新增的订阅条数（增量采集）
 */
export const SUBSCRIBE_SYNC_BATCH = 10

export const SUBSCRIBE_PLATFORM_META: Record<string, { label: string }> = {
  douyin: { label: '抖音' },
  kuaishou: { label: '快手' },
  xiaohongshu: { label: '小红书' },
  bilibili: { label: 'B站' }
}

export const subscribePlatformLabel = (platform?: string): string =>
  (platform && SUBSCRIBE_PLATFORM_META[platform]?.label) || platform || ''

export const SUBSCRIBE_STATUS_META: Record<SubscribeStatus, { label: string; theme: SubscribeTagTheme }> = {
  idle: { label: '待处理', theme: 'default' },
  downloading: { label: '下载中', theme: 'warning' },
  ready: { label: '已下载', theme: 'primary' },
  transcribing: { label: '转写中', theme: 'warning' },
  transcribed: { label: '已转写', theme: 'primary' },
  summarizing: { label: '总结中', theme: 'warning' },
  summarized: { label: '已完成', theme: 'success' },
  error: { label: '出错', theme: 'danger' }
}

export const SUBSCRIBE_LANGUAGE_OPTIONS: CommonSelect[] = [
  { value: 'auto', label: '自动检测' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英文' },
  { value: 'ja', label: '日文' },
  { value: 'ko', label: '韩文' },
  { value: 'yue', label: '粤语' }
]

export const SUBSCRIBE_DEVICE_OPTIONS: CommonSelect[] = [
  { value: 'cpu', label: 'CPU' },
  { value: 'cuda', label: 'CUDA（GPU）' }
]
