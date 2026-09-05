import { reactive } from 'vue'

/** 页面状态：主页面即 Markdown 卡片（内容为 Markdown 源码，卡片经 NoteCardRenderer 富渲染分页） */
export interface CardState {
  /** 文章 Markdown 源码 */
  content: string
  /** 作者昵称（首页卡头展示） */
  nickname: string
  /** 日期（首页卡头昵称下方小字） */
  dateStr: string
  /** 作者头像 dataURL / 资源 URL */
  avatar: string | null
  /** 页尾水印（每张卡底部） */
  watermark: string
  /** 卡片风格 id（空 = 默认预设） */
  styleId: string
}

export const todayStr = (): string => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 页面单例状态（模块级，路由切换不丢） */
export const state = reactive({
  content: [
    '## 周末去了趟青云山',
    '',
    '山里的空气特别清新，**云海**在脚下慢慢流动，走到一半突然放晴。',
    '',
    '> 最好的风景，总在人少的地方。',
    '',
    '- 全程步行约 8 公里',
    '- 山顶的日出值得早起',
    '',
    '==下次还来=='
  ].join('\n'),
  nickname: '落雨不悔',
  dateStr: todayStr(),
  avatar: '',
  watermark: 'Created by Mistrelle',
  styleId: ''
}) as CardState
