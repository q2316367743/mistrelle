/**
 * 应用集成 IPC handler（main 进程）：外部软件接入配置的检查与安装。
 * 事件消费不走 IPC（各设备域 init 内经 buddyEventBus 订阅）。
 */
import { ipcMain } from 'electron'
import { IntegrationChannels } from '@common/buddy/integrations/integrationChannels'
import type { PlatformInstallResult, PlatformStatus } from '@common/types/integrations'
import { checkPlatform, installPlatform } from './platformConfig'

export function registerIntegrationsIpc(): void {
  ipcMain.handle(IntegrationChannels.check, (_event, software: string): PlatformStatus =>
    checkPlatform(software)
  )
  ipcMain.handle(IntegrationChannels.install, (_event, software: string): PlatformInstallResult =>
    installPlatform(software)
  )
}
