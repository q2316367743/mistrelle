/**
 * gzh 域 IPC 契约：通道常量。
 * preload 桥与 main handler 共用，保持两侧契约一致。
 */
export const GzhChannels = {
  /** 公众号爆款数据抓取（四榜 / 赛道），入参出参见 GzhApi.trends */
  trends: 'gzh:trends'
} as const
