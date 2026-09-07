/**
 * 额度插件域（公共域）IPC 通道常量（main / preload 共用）。
 * 通道命名沿用 'domain:action' 约定；域类型在 @common/types/quota，
 * 配置由 main 进程持有，落盘 ~/.mistrelle/buddy/quota.json。
 * 额度插件是独立公共域：快照经 quotaBus（main 内）分发给订阅设备（ESP32 LCD 等）。
 */

export const QuotaChannels = {
  /** 读取整份配置 */
  getConfig: 'quota:getConfig',
  /** 保存整份配置（main 归一化后落盘；刷新定时器随间隔变化自动重启） */
  saveConfig: 'quota:saveConfig',
  /** 列出全部额度插件（内置 + 插件目录第三方） */
  listPlugins: 'quota:listPlugins',
  /** 在系统文件管理器中打开插件目录 */
  openPluginsDir: 'quota:openPluginsDir',
  /** 立即执行一次额度刷新 */
  runNow: 'quota:runNow',
  /** 读取最近一次快照 */
  getLastSnapshot: 'quota:getLastSnapshot',
  /** 主进程 → 渲染层：额度快照更新（定时/手动刷新完成后推送） */
  snapshot: 'quota:snapshot'
} as const
