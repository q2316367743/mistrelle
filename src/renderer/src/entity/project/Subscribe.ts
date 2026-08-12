import { BaseEntity } from '@/entity'

/**
 * 订阅状态（流水线进度）
 */
export type SubscribeStatus =
  | 'idle'
  | 'downloading'
  | 'ready'
  | 'transcribing'
  | 'transcribed'
  | 'summarizing'
  | 'summarized'
  | 'error'

/**
 * 识别参数（转写时透传给 FunASR 脚本）
 */
export interface SubscribeRecognizeSetting {
  // 语言：auto / zh / en / ja / ko / yue…
  language?: string
  // 计算设备：cpu / cuda
  device?: string
  // 逆文本正则化（数字/标点还原）
  itn?: boolean
  // 热词
  hotword?: string
}

export const buildSubscribeRecognizeSetting = (): SubscribeRecognizeSetting => ({
  language: 'zh',
  device: 'cpu',
  itn: true
})

/**
 * 博主
 */
export interface SubscribeBlogger extends BaseEntity {
  // 名字
  name: string
  // 头像
  avatar?: string
  // 博主主页链接
  url: string
  // 平台：douyin / kuaishou / xiaohongshu / bilibili…
  platform?: string
  // 笔记/视频数量
  videoCount?: number
  // 识别参数（该博主下所有订阅转写时继承）
  recognize: SubscribeRecognizeSetting
}

/**
 * 视频订阅
 */
export interface SubscribeItem extends BaseEntity {
  // 标题
  title: string
  // 封面
  cover?: string
  // 视频详情链接
  url: string
  // 发布日期
  publishDate?: string
  // 描述
  description?: string
  // 视频直链
  videoUrl?: string
  // 音频直链
  audioUrl?: string
  // 状态
  status: SubscribeStatus
  // 错误信息
  error?: string
}

export const buildSubscribeBlogger = (): SubscribeBlogger => ({
  id: '',
  name: '',
  url: '',
  recognize: buildSubscribeRecognizeSetting(),
  createdAt: Date.now(),
  updatedAt: Date.now()
})

export const buildSubscribeItem = (): SubscribeItem => ({
  id: '',
  title: '',
  url: '',
  status: 'idle',
  createdAt: Date.now(),
  updatedAt: Date.now()
})
