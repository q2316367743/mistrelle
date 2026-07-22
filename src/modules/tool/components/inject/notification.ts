import { ToolFunction } from '@/domain'

export const injectNotificationTools: ToolFunction[] = [
  {
    name: 'notification_show',
    label: '显示通知',
    description: '显示系统桌面通知',
    parameters: {
      type: 'object',
      properties: {
        body: { type: 'string', description: '通知正文内容' },
        featureName: { type: 'string', description: '功能名称（可选）' },
      },
      required: ['body'],
    },
    requireConfirm: true,
    handler: async (...params: unknown[]) => {
      const { body, featureName } = params[0] as {
        body: string
        featureName?: string
      }
      window.preload.inject.notification.show(body, featureName)
      return { success: true }
    },
  },
]
