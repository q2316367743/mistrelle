/**
 * 红绿灯桥（preload）：traffic-light 域的 IPC 薄封装。
 * 配置读写与事件映射都在 main（TrafficLightService 单例），渲染层只调用类型化方法。
 */
import { ipcRenderer } from 'electron'
import { TrafficLightChannels } from '@common/buddy/traffic-light/trafficLightChannels'
import type {
  PlatformInstallResult,
  PlatformStatus,
  SoftwareLightConfig,
  SoftwareName,
  TrafficLightConfig,
  TrafficLightSaveResult
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
  /** 记住上次使用的串口（伙伴窗口连接成功后调用） */
  setLastPort: (path: string): Promise<void> =>
    ipcRenderer.invoke(TrafficLightChannels.setLastPort, path),
  /** 检查指定软件的事件接入配置状态（opencode = 插件文件与内置模板比对） */
  checkPlatform: (software: SoftwareName): Promise<PlatformStatus> =>
    ipcRenderer.invoke(TrafficLightChannels.checkPlatform, software),
  /** 安装/更新指定软件的事件接入配置（覆盖写入其插件目录） */
  installPlatform: (software: SoftwareName): Promise<PlatformInstallResult> =>
    ipcRenderer.invoke(TrafficLightChannels.installPlatform, software)
}
