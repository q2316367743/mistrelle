/**
 * 应用集成桥（preload）：integrations 域的 IPC 薄封装。
 * 外部软件接入配置的检查与安装（如 opencode 内置事件插件），逻辑都在 main（platformConfig）。
 */
import { ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { IntegrationChannels } from '@common/buddy/integrations/integrationChannels'
import type {
  IntegrationActivityEntry,
  PlatformInstallResult,
  PlatformStatus
} from '@common/types/integrations'
import type { SoftwareName } from '@common/types/trafficLight'

export const integrationsApi = {
  /** 检查指定软件的接入配置状态（opencode = 插件文件与内置模板比对） */
  checkPlatform: (software: SoftwareName): Promise<PlatformStatus> =>
    ipcRenderer.invoke(IntegrationChannels.check, software),
  /** 安装/更新指定软件的接入配置（覆盖写入其插件目录） */
  installPlatform: (software: SoftwareName): Promise<PlatformInstallResult> =>
    ipcRenderer.invoke(IntegrationChannels.install, software),
  /** 卸载指定软件的接入配置（opencode 删插件文件；zcode 摘钩子条目并删脚本目录） */
  uninstallPlatform: (software: SoftwareName): Promise<PlatformInstallResult> =>
    ipcRenderer.invoke(IntegrationChannels.uninstall, software),
  /** 拉取调试事件流（全量缓冲，含未命中白名单被丢弃的请求；纯内存，重启清空） */
  getActivity: (): Promise<IntegrationActivityEntry[]> =>
    ipcRenderer.invoke(IntegrationChannels.getActivity),
  /** 清空全部调试事件流 */
  clearActivity: (): Promise<void> => ipcRenderer.invoke(IntegrationChannels.clearActivity),
  /** 订阅实时调试事件流推送；返回取消订阅函数 */
  onActivity: (callback: (entry: IntegrationActivityEntry) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, entry: IntegrationActivityEntry): void =>
      callback(entry)
    ipcRenderer.on(IntegrationChannels.activity, listener)
    return () => {
      ipcRenderer.removeListener(IntegrationChannels.activity, listener)
    }
  }
}
