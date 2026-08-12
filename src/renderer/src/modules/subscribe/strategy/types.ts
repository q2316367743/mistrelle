/**
 * 可下载资源：单个视频详情链接解析出的直链信息
 */
export interface SubscribeResource {
  title: string
  description?: string
  videoUrl?: string
  audioUrl?: string
  platform?: string
}

/**
 * 博主信息
 */
export interface SubscribeBloggerResource {
  name: string
  avatar?: string
  platform?: string
  videoCount?: number
}

/**
 * 博主视频列表条目
 */
export interface SubscribeVideoResource {
  title: string
  cover?: string
  url: string
  publishDate?: string
}

/**
 * 订阅策略：按链接匹配平台，提供视频解析与博主信息/视频列表抓取。
 * 具体实现（抖音/快手/小红书/B 站）在 strategy/register.ts 中注册。
 */
export interface SubscribeStrategy {
  id: string
  label: string
  // 是否匹配该链接（域名或正则）
  match(url: string): boolean
  // 视频详情链接 → 可下载资源
  resolveResource(url: string): Promise<SubscribeResource>
  // 博主主页链接 → 博主信息
  resolveBlogger(url: string): Promise<SubscribeBloggerResource>
  // 博主主页链接 → 全部视频列表
  resolveBloggerVideos(url: string): Promise<SubscribeVideoResource[]>
}
