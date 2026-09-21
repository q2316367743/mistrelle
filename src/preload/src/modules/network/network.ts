/**
 * network 桥（preload）：网络设置读写薄封装。
 * 设置数据家在 main（内存缓存 + 写时刷新，保存即生效），渲染层 store 经此读写。
 */
import { ipcRenderer } from 'electron'
import { NetworkChannels } from './networkChannels'
import type { SettingNetwork } from '@common/types/networkSetting'

export const networkApi = {
  /** 读取网络设置（main 侧归一化，缺失字段回退默认值） */
  getSetting: (): Promise<SettingNetwork> => ipcRenderer.invoke(NetworkChannels.getSetting),
  /** 保存网络设置（main 全量覆写落盘，返回归一化结果） */
  saveSetting: (setting: SettingNetwork): Promise<SettingNetwork> =>
    ipcRenderer.invoke(NetworkChannels.saveSetting, setting)
}
