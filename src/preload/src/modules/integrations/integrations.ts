/**
 * 应用集成桥（preload）：integrations 域的 IPC 薄封装。
 * 外部软件接入配置的检查与安装（如 opencode 内置事件插件），逻辑都在 main（platformConfig）。
 */
import { ipcRenderer } from 'electron'
import { IntegrationChannels } from '@common/buddy/integrations/integrationChannels'
import type { PlatformInstallResult, PlatformStatus } from '@common/types/integrations'
import type { SoftwareName } from '@common/types/trafficLight'

export const integrationsApi = {
  /** 检查指定软件的接入配置状态（opencode = 插件文件与内置模板比对） */
  checkPlatform: (software: SoftwareName): Promise<PlatformStatus> =>
    ipcRenderer.invoke(IntegrationChannels.check, software),
  /** 安装/更新指定软件的接入配置（覆盖写入其插件目录） */
  installPlatform: (software: SoftwareName): Promise<PlatformInstallResult> =>
    ipcRenderer.invoke(IntegrationChannels.install, software)
}
