/**
 * 额度插件桥（preload）：quota 公共域的 IPC 薄封装 + 快照推送订阅。
 * 配置读写、插件扫描、刷新调度都在 main（quotaService 单例），渲染层只调用类型化方法。
 */
import { ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { QuotaChannels } from '@common/buddy/quota/quotaChannels'
import type {
  QuotaConfig,
  QuotaPluginDescriptor,
  QuotaSaveResult,
  QuotaSnapshot
} from '@common/types/quota'

export const quotaApi = {
  /** 读取整份配置 */
  getConfig: (): Promise<QuotaConfig> => ipcRenderer.invoke(QuotaChannels.getConfig),
  /** 保存整份配置（main 归一化后落盘；刷新定时器随间隔变化自动重启） */
  saveConfig: (config: QuotaConfig): Promise<QuotaSaveResult> =>
    ipcRenderer.invoke(QuotaChannels.saveConfig, config),
  /** 列出全部额度插件（内置预置 + 插件目录第三方扫描，统一模型） */
  listPlugins: (): Promise<QuotaPluginDescriptor[]> =>
    ipcRenderer.invoke(QuotaChannels.listPlugins),
  /** 在系统文件管理器中打开插件目录（不存在则先创建） */
  openPluginsDir: (): Promise<void> => ipcRenderer.invoke(QuotaChannels.openPluginsDir),
  /** 立即执行一次额度刷新（返回快照；同时经快照总线分发给各订阅设备并推送渲染层） */
  runNow: (): Promise<QuotaSnapshot> => ipcRenderer.invoke(QuotaChannels.runNow),
  /** 读取最近一次快照（无则 null） */
  getLastSnapshot: (): Promise<QuotaSnapshot | null> =>
    ipcRenderer.invoke(QuotaChannels.getLastSnapshot),
  /** 订阅额度快照更新推送；返回取消订阅函数 */
  onSnapshot: (callback: (snapshot: QuotaSnapshot) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, snapshot: QuotaSnapshot): void =>
      callback(snapshot)
    ipcRenderer.on(QuotaChannels.snapshot, listener)
    return () => {
      ipcRenderer.removeListener(QuotaChannels.snapshot, listener)
    }
  }
}

export type QuotaPreloadApi = typeof quotaApi
