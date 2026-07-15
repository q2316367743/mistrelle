import { ToolFunction } from '@/domain'

export const injectScreenTools: ToolFunction[] = [
  {
    name: 'screen_capture',
    label: '截图',
    description: '截取屏幕画面，返回 base64 编码的图片',
    parameters: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      return new Promise((resolve) => {
        window.preload.inject.screen.capture((imgBase64: string) => {
          resolve({ image: imgBase64 })
        })
      })
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
    handler: async () => {
      return new Promise((resolve) => {
        window.preload.inject.screen.colorPick((color) => {
          resolve({ hex: color.hex, rgb: color.rgb })
        })
      })
    },
  },
]
