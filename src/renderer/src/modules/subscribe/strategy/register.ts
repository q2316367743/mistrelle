import type { SubscribeStrategy } from './types'
import { registerSubscribeStrategy } from './registry'

/**
 * 各平台策略实现（抖音/快手/小红书/B 站）在此登记。
 * 参考 types.ts 中的 SubscribeStrategy 契约，将实现文件加入数组即可自动注册。
 */
const strategies: SubscribeStrategy[] = []

strategies.forEach((strategy) => registerSubscribeStrategy(strategy))

export {}
