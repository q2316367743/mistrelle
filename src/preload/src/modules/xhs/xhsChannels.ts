/**
 * xhs 域 IPC 契约：通道常量。
 * preload 桥与 main handler 共用，保持两侧契约一致。
 */
export const XhsChannels = {
  /** 小红书热点取数（红狐 API），入参出参见 XhsApi.hotNotes */
  hotNotes: 'xhs:hot-notes'
} as const
