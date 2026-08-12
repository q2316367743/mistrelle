import { ToolFunction } from '@/domain'

export const injectOsTools: ToolFunction[] = [
  {
    name: 'os_info',
    label: '获取系统信息',
    description: '获取当前操作系统信息，包括平台类型、深色模式、应用版本等',
    parameters: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const inject = window.preload.inject
      const [isMacOS, isWindows, isLinux, isDarkMode, isDev, appName, appVersion, nativeId] =
        await Promise.all([
          inject.os.isMacOS(),
          inject.os.isWindows(),
          inject.os.isLinux(),
          inject.os.isDarkColors(),
          inject.os.isDev(),
          inject.os.getAppName(),
          inject.os.getAppVersion(),
          inject.os.getNativeId()
        ])
      return {
        platform: inject.getPlatform(),
        isMacOS,
        isWindows,
        isLinux,
        isDarkMode,
        isDev,
        appName,
        appVersion,
        nativeId,
      }
    },
  },
]
