/**
 * 额度插件域 IPC handler（main 进程）：配置读写 / 插件列表 / 插件目录 / 立即刷新 / 快照查询。
 * 设备消费不经本域（设备在各自 init 内订阅 quotaBus，见 quotaBus.ts）。
 */
import { shell } from 'electron'
import { ipcMain } from 'electron'
import { QuotaChannels } from '@common/buddy/quota/quotaChannels'
import type {
  QuotaConfig,
  QuotaPluginDescriptor,
  QuotaSaveResult,
  QuotaSnapshot
} from '@common/types/quota'
import { BUILTIN_QUOTA_PLUGINS } from './builtinPlugins'
import { collectQuotaPlugin } from './quotaRunner'
import { ensurePluginsDir, scanExternalPlugins } from './externalPlugins'
import {
  getLastQuotaSnapshot,
  getQuotaConfig,
  runQuotaNow,
  saveQuotaConfig
} from './quotaService'

/** 内置插件元数据：源码声明为准（collect 取 id/name/settings），失败记 error 容错 */
function builtinDescriptors(): QuotaPluginDescriptor[] {
  return BUILTIN_QUOTA_PLUGINS.map((plugin) => {
    const base: QuotaPluginDescriptor = {
      source: 'builtin',
      key: plugin.key,
      id: plugin.key,
      name: plugin.key,
      settings: []
    }
    try {
      const manifest = collectQuotaPlugin(plugin.code)
      return {
        ...base,
        id: manifest.id,
        name: manifest.name || manifest.id,
        settings: manifest.settings ?? []
      }
    } catch (e) {
      return { ...base, name: plugin.key, error: '内置插件加载失败：' + (e as Error).message }
    }
  })
}

export function registerQuotaIpc(): void {
  ipcMain.handle(QuotaChannels.getConfig, (): QuotaConfig => getQuotaConfig())
  ipcMain.handle(QuotaChannels.saveConfig, (_event, raw: unknown): QuotaSaveResult =>
    saveQuotaConfig(raw)
  )
  ipcMain.handle(QuotaChannels.listPlugins, (): QuotaPluginDescriptor[] => [
    ...builtinDescriptors(),
    ...scanExternalPlugins()
  ])
  ipcMain.handle(QuotaChannels.openPluginsDir, async (): Promise<void> => {
    await shell.openPath(ensurePluginsDir())
  })
  ipcMain.handle(QuotaChannels.runNow, (): Promise<QuotaSnapshot> => runQuotaNow())
  ipcMain.handle(QuotaChannels.getLastSnapshot, (): QuotaSnapshot | null => getLastQuotaSnapshot())
}
