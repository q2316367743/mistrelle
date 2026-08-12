import type {
  SubscribeBloggerResource,
  SubscribeResource,
  SubscribeStrategy,
  SubscribeVideoResource
} from './types'

const strategies: SubscribeStrategy[] = []

/**
 * 注册订阅策略实现
 */
export const registerSubscribeStrategy = (strategy: SubscribeStrategy): void => {
  strategies.push(strategy)
}

const findStrategy = (url: string): SubscribeStrategy => {
  const strategy = strategies.find((s) => s.match(url))
  if (!strategy) {
    throw new Error(`未找到支持该链接的订阅策略：${url}`)
  }
  return strategy
}

export const resolveSubscribeResource = (url: string): Promise<SubscribeResource> =>
  findStrategy(url).resolveResource(url)

export const resolveSubscribeBlogger = (url: string): Promise<SubscribeBloggerResource> =>
  findStrategy(url).resolveBlogger(url)

export const resolveSubscribeBloggerVideos = (url: string): Promise<SubscribeVideoResource[]> =>
  findStrategy(url).resolveBloggerVideos(url)
