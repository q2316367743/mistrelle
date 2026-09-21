/**
 * 公众号域类型（window.preload.gzh）：爆款数据抓取桥。
 * 契约与 main / preload 三方共用，集中在 @common/types/gzhTrends。
 */
import type { GzhTrendsRequest, GzhTrendsResponse } from '@common/types/gzhTrends'

declare interface GzhApi {
  /** 公众号爆款数据：mode=keyword 四榜查询 / mode=sector 赛道聚合（实现位于 main） */
  trends: (req: GzhTrendsRequest) => Promise<GzhTrendsResponse>
}
