/**
 * gzh 桥（preload）：公众号爆款数据抓取。
 * 实现在 main（gzhTrends.ts，源站需非常规 TLS 回退），渲染层经此薄桥调用。
 */
import { ipcRenderer } from 'electron'
import { GzhChannels } from './gzhChannels'
import type {
  GzhTrendsRequest,
  GzhTrendsResponse
} from '@common/types/gzhTrends'

export const gzhApi = {
  /** 公众号爆款数据：mode=keyword 四榜查询 / mode=sector 赛道聚合 */
  trends: (req: GzhTrendsRequest): Promise<GzhTrendsResponse> =>
    ipcRenderer.invoke(GzhChannels.trends, req)
}
