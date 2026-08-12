import { ToolFunction } from '@/domain'

/**
 * 截图 / 取色工具（Electron 迁移后暂不可用）。
 * inject.screen 已随 utools 平台能力移除，保留工具位并返回友好错误。
 */
export const injectScreenTools: ToolFunction[] = [
  {
    name: 'screen_capture',
    label: '截图',
    description: '截取屏幕画面，返回 base64 编码的图片',
    parameters: {
      type: 'object',
      properties: {},
    },
    risk: 'sensitive',
    handler: async () => {
      return { error: '当前环境不支持屏幕截图（Electron 迁移中，待实现）' }
    },
  },
  {
    name: 'screen_color_pick',
    label: '取色',
    description: '从屏幕任意位置选取颜色，返回 HEX 和 RGB 值',
    parameters: {
      type: 'object',
      properties: {},
    },
    risk: 'sensitive',
    handler: async () => {
      return { error: '当前环境不支持屏幕取色（Electron 迁移中，待实现）' }
    },
  },
]
