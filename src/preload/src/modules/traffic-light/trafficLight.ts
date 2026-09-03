/**
 * 红绿灯桥（preload）：traffic-light 域的 IPC 薄封装。
 * 配置读写与事件映射都在 main（TrafficLightService 单例），渲染层只调用类型化方法。
 */
import { ipcRenderer } from 'electron'
import {
  TrafficLightChannels,
  type SoftwareLightConfig,
  type SoftwareName,
  type TrafficLightConfig,
  type TrafficLightSaveResult
} from './trafficLightChannels'

export const trafficLightApi = {
  /** 读取整份配置（含 lastPort 与各软件绑定） */
  getConfig: (): Promise<TrafficLightConfig> => ipcRenderer.invoke(TrafficLightChannels.getConfig),
  /** 保存单个软件配置；结果由 main 校验给出（灯态唯一/软件互斥） */
  saveSoftwareConfig: (
    software: SoftwareName,
    config: SoftwareLightConfig
  ): Promise<TrafficLightSaveResult> =>
    ipcRenderer.invoke(TrafficLightChannels.saveSoftwareConfig, software, config),
  /** 记住上次使用的串口（伙伴窗口连接成功后调用） */
  setLastPort: (path: string): Promise<void> =>
    ipcRenderer.invoke(TrafficLightChannels.setLastPort, path)
}

export type TrafficLightApi = typeof trafficLightApi
