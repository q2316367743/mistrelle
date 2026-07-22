import { ToolFunction } from '@/domain'

export const injectBrowserTools: ToolFunction[] = [
  {
    name: 'browser_open',
    label: '打开链接',
    description: '在系统默认浏览器中打开指定的 URL',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '要打开的网址' },
      },
      required: ['url'],
    },
    requireConfirm: true,
    handler: async (...params: unknown[]) => {
      const { url } = params[0] as { url: string }
      window.preload.inject.shell.openExternal(url)
      return { success: true }
    },
  },
]
