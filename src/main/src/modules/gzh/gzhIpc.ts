/**
 * gzh IPC handler（main 进程）：公众号爆款数据抓取。
 * 抓取逻辑在同目录 gzhTrends.ts（源站需 TLS 回退与重试，集中 main）。
 */
import { ipcMain } from 'electron'
import { GzhChannels } from '~/modules/gzh/gzhChannels'
import { fetchGzhTrends } from './gzhTrends'
import type { GzhTrendsRequest } from '@common/types/gzhTrends'

export function registerGzhIpc(): void {
  ipcMain.handle(GzhChannels.trends, (_event, req: GzhTrendsRequest) => fetchGzhTrends(req))
}
