import { reactive } from 'vue'
import type { XhsImage } from './protocol'
import defaultAvatar from './default-avatar.png'

/** 页面状态（参考站 Home 的 state 集合 + 卡片风格 id） */
export interface StudioState {
  content: string
  nickname: string
  dateStr: string
  avatar: string | null
  images: Array<XhsImage>
  watermark: string
  /** 卡片风格 id（空 = 参考站原版样式） */
  styleId: string
}

export const DEFAULT_AVATAR = defaultAvatar

export const todayStr = (): string => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 页面单例状态（模块级，路由切换不丢） */
export const state = reactive({
  content: `今天发现了一个超好用的小工具！
[img]
可以把文章直接转换成小红书风格的图文卡片，排版特别干净。
用起来很简单，在需要放图的位置点「插入配图」就行，图片就会出现在文字中间。
导出后是高清的 PNG，直接就能发小红书了~
推荐给需要的朋友试试！`,
  nickname: '落雨不悔',
  dateStr: todayStr(),
  avatar: DEFAULT_AVATAR,
  images: [] as Array<XhsImage>,
  watermark: 'Created by Mistrelle',
  styleId: ''
}) as StudioState

/** 参考站共用输入框样式 */
export const INPUT_CLASS =
  'w-full px-4 py-2.5 bg-[#F5F5F5] rounded-xl border-none text-sm text-[#1A1A1A] placeholder:text-[#888] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/10'
