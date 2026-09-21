/**
 * network 域 IPC 契约：通道常量。
 * preload 桥与 main handler 共用，保持两侧契约一致。
 */
export const NetworkChannels = {
  /** 读取网络设置（main 归一化后返回） */
  getSetting: 'network:getSetting',
  /** 保存网络设置（main 全量覆写落盘，返回归一化结果） */
  saveSetting: 'network:saveSetting'
} as const
