import { ToolFunction } from '@/domain'

export const injectClipboardTools: ToolFunction[] = [
  {
    name: 'clipboard_read',
    label: '读取剪贴板',
    description: '读取系统剪贴板中的文本内容',
    parameters: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const text = await navigator.clipboard.readText()
      return { text }
    },
  },
  {
    name: 'clipboard_copy',
    label: '复制到剪贴板',
    description: '将指定文本复制到系统剪贴板',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要复制的文本内容' },
      },
      required: ['text'],
    },
    handler: async (...params: unknown[]) => {
      const { text } = params[0] as { text: string }
      const ok = window.preload.inject.clipboard.copyText(text)
      return { success: ok }
    },
  },
]
