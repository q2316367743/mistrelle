/**
 * 红绿灯桥（preload）：traffic-light 域的 IPC 薄封装 + 运行态推送订阅。
 * 配置读写、连接编排、事件消费都在 main（TrafficLightService 单例），渲染层只调用类型化方法。
 */
import { ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { TrafficLightChannels } from '@common/buddy/traffic-light/trafficLightChannels'
import type {
  SoftwareLightConfig,
  SoftwareName,
  TrafficLightConfig,
  TrafficLightSaveResult,
  TrafficLightState
} from '@common/types/trafficLight'

export const trafficLightApi = {
  /** 读取整份配置（含 lastPort 与各软件绑定） */
  getConfig: (): Promise<TrafficLightConfig> => ipcRenderer.invoke(TrafficLightChannels.getConfig),
  /** 保存单个软件配置；结果由 main 校验给出（灯态唯一/软件互斥） */
  saveSoftwareConfig: (
    software: SoftwareName,
    config: SoftwareLightConfig
  ): Promise<TrafficLightSaveResult> =>
    ipcRenderer.invoke(TrafficLightChannels.saveSoftwareConfig, software, config),
  /** 记住上次使用的串口（连接成功时 main 自动调用，渲染层一般无需直接使用） */
  setLastPort: (path: string): Promise<void> =>
    ipcRenderer.invoke(TrafficLightChannels.setLastPort, path),
  /** 连接串口（9600 固定波特率；成功即记忆 lastPort 并广播运行态） */
  connect: (path: string): Promise<TrafficLightSaveResult> =>
    ipcRenderer.invoke(TrafficLightChannels.connect, path),
  /** 断开当前连接 */
  disconnect: (): Promise<void> => ipcRenderer.invoke(TrafficLightChannels.disconnect),
  /** 发送一条灯态指令（调试面板用；未连接时 reject） */
  sendCommand: (code: string): Promise<void> =>
    ipcRenderer.invoke(TrafficLightChannels.sendCommand, code),
  /** 读取连接运行态 */
  getState: (): Promise<TrafficLightState> => ipcRenderer.invoke(TrafficLightChannels.getState),
  /** 订阅连接运行态变化推送；返回取消订阅函数 */
  onState: (callback: (state: TrafficLightState) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, state: TrafficLightState): void => callback(state)
    ipcRenderer.on(TrafficLightChannels.state, listener)
    return () => {
      ipcRenderer.removeListener(TrafficLightChannels.state, listener)
    }
  }
}
