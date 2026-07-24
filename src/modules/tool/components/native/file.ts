import { ToolFunction } from '@/domain'
import { useSettingSecureStore } from '@/store/setting/SettingSecureStore'
import { isPathBlacklisted } from '@/utils/sandbox'

function checkBlacklist(path: string): string | null {
  const store = useSettingSecureStore()
  const { sandbox } = store.state
  if (sandbox.enabled && sandbox.fileBlackList && isPathBlacklisted(path, sandbox.fileBlackList)) {
    return `路径 ${path} 在黑名单中，已被安全策略拦截`
  }
  return null
}

export const fileTools: ToolFunction[] = [
  {
    name: 'file_list',
    label: '列出目录',
    description: '列出指定目录下的所有文件和子目录信息，包括名称、大小、修改时间等',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '要列出的目录路径' }
      },
      required: ['path']
    },
    requireConfirm: false,
    handler: async (...params: unknown[]) => {
      const { path } = params[0] as { path: string }
      const error = checkBlacklist(path)
      if (error) return { error }
      return window.preload.fs.readDir(path)
    }
  },
  {
    name: 'file_read',
    label: '读取文件',
    description: '读取指定文本文件的全部内容（UTF-8 编码）',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '要读取的文件路径' }
      },
      required: ['path']
    },
    requireConfirm: false,
    handler: async (...params: unknown[]) => {
      const { path } = params[0] as { path: string }
      const error = checkBlacklist(path)
      if (error) return { error }
      const content = await window.preload.fs.readTextFile(path)
      return { content }
    }
  },
  {
    name: 'file_write',
    label: '写入文件',
    description: '将文本内容写入指定文件（UTF-8 编码），文件不存在则创建，存在则覆盖',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '要写入的文件路径' },
        content: { type: 'string', description: '要写入的文本内容' }
      },
      required: ['path', 'content']
    },
    requireConfirm: true,
    handler: async (...params: unknown[]) => {
      const { path, content } = params[0] as { path: string; content: string }
      const error = checkBlacklist(path)
      if (error) return { error }
      await window.preload.fs.writeTextFile(path, content)
      return { success: true }
    }
  },
  {
    name: 'file_delete',
    label: '删除文件或目录',
    description: '删除指定的文件或目录，若启用删除保护则优先移至废纸篓',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '要删除的文件或目录路径' }
      },
      required: ['path']
    },
    requireConfirm: true,
    handler: async (...params: unknown[]) => {
      const { path } = params[0] as { path: string }
      const store = useSettingSecureStore()
      const { sandbox, data } = store.state
      if (sandbox.enabled && sandbox.fileBlackList && isPathBlacklisted(path, sandbox.fileBlackList)) {
        return { error: `路径 ${path} 在黑名单中，已被安全策略拦截` }
      }
      if (data.deleteProtection) {
        await window.preload.inject.shell.trashItem(path)
        return { success: true, action: 'trash' }
      }
      await window.preload.fs.rm(path)
      return { success: true, action: 'delete' }
    }
  },
  {
    name: 'file_mkdir',
    label: '创建目录',
    description: '创建指定目录，支持递归创建多级目录',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '要创建的目录路径' }
      },
      required: ['path']
    },
    requireConfirm: false,
    handler: async (...params: unknown[]) => {
      const { path } = params[0] as { path: string }
      await window.preload.fs.mkdir(path)
      return { success: true }
    }
  },
  {
    name: 'file_exists',
    label: '检查路径是否存在',
    description: '检查指定文件或目录是否存在',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '要检查的文件或目录路径' }
      },
      required: ['path']
    },
    requireConfirm: false,
    handler: async (...params: unknown[]) => {
      const { path } = params[0] as { path: string }
      const exists = window.preload.fs.existsSync(path)
      return { exists }
    }
  }
]
