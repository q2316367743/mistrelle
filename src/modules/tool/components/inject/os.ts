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
      return {
        platform: inject.getPlatform(),
        isMacOS: inject.os.isMacOS(),
        isWindows: inject.os.isWindows(),
        isLinux: inject.os.isLinux(),
        isDarkMode: inject.os.isDarkColors(),
        isDev: inject.os.isDev(),
        appName: inject.os.getAppName(),
        appVersion: inject.os.getAppVersion(),
        nativeId: inject.os.getNativeId(),
      }
    },
  },
]
