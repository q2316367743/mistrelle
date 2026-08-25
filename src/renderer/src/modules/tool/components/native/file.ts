import { ToolFunction } from '@/domain'
import { useSettingSecureStore } from '@/store/setting/SettingSecureStore'
import { isPathBlacklisted } from '@/utils/sandbox'
import { readImageInfo } from '@/utils/imageInfo'

function checkBlacklist(path: string): string | null {
  const store = useSettingSecureStore()
  const { sandbox } = store.state
  if (sandbox.enabled && sandbox.fileBlackList && isPathBlacklisted(path, sandbox.fileBlackList)) {
    return `路径 ${path} 在黑名单中，已被安全策略拦截`
  }
  return null
}

/** file_read 默认每页行数 */
const FILE_READ_DEFAULT_LINES = 500
/** file_read 单次读取行数上限 */
const FILE_READ_MAX_LINES = 2000

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
    risk: 'safe',
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
    description:
      '按行分页读取纯文本文件（UTF-8 编码），适用于 .txt/.md/.json/.csv/.ts/.js/.css 等文本格式。默认读取前 500 行；返回带 nextOffset 表示还有剩余行，传 offset 续读（limit 上限 2000）。部分读取时每行带「行号|」前缀。单行超长文件（如压缩 JSON）不适用按行分页。docx/xlsx/pdf 请使用 file_read_docx / file_read_xlsx / file_read_pdf',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '要读取的文件路径' },
        offset: { type: 'number', description: '起始行号（1 起始），默认 1；续读时传上次返回的 nextOffset' },
        limit: { type: 'number', description: `本次读取行数，默认 ${FILE_READ_DEFAULT_LINES}，上限 ${FILE_READ_MAX_LINES}` }
      },
      required: ['path']
    },
    risk: 'safe',
    handler: async (...params: unknown[]) => {
      const { path, offset, limit } = params[0] as { path: string; offset?: number; limit?: number }
      const error = checkBlacklist(path)
      if (error) return { error }
      const startLine = Math.max(1, Math.floor(offset ?? 1))
      const lineCount = Math.min(FILE_READ_MAX_LINES, Math.max(1, Math.floor(limit ?? FILE_READ_DEFAULT_LINES)))
      try {
        const { lines, totalLines, hasMore } = await window.preload.fs.readFileLines(path, startLine, lineCount)
        // 首页即全量：原文直出，与整读行为兼容（不带行号）
        if (!hasMore && startLine === 1 && totalLines === lines.length) {
          return { content: lines.join('\n'), totalLines }
        }
        if (!hasMore && lines.length === 0 && totalLines !== null && startLine > totalLines) {
          return { content: '', totalLines, offset: startLine, hint: `offset 超出文件总行数（共 ${totalLines} 行）` }
        }
        const content = lines.map((line, i) => `${startLine + i}|${line}`).join('\n')
        const response: { content: string; totalLines: number | null; offset: number; nextOffset?: number } = {
          content,
          totalLines,
          offset: startLine
        }
        if (hasMore) response.nextOffset = startLine + lines.length
        return response
      } catch (e) {
        return { error: `读取文件失败：${e instanceof Error ? e.message : String(e)}` }
      }
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
    risk: 'sensitive',
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
    risk: 'dangerous',
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
    risk: 'safe',
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
    risk: 'safe',
    handler: async (...params: unknown[]) => {
      const { path } = params[0] as { path: string }
      const exists = window.preload.fs.existsSync(path)
      return { exists }
    }
  },
  {
    name: 'image_info',
    label: '读取图片信息',
    description:
      '读取本地图片文件的实际格式与宽高（基于系统内置图像引擎，支持 png / jpeg / webp / gif 等常见位图格式）。给 image 节点设置 width/height 前先调用，按真实尺寸等比缩放，避免失真；格式由图像引擎按内容判定（与扩展名无关）。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '图片文件路径' }
      },
      required: ['path']
    },
    risk: 'safe',
    handler: async (...params: unknown[]) => {
      const { path } = params[0] as { path: string }
      const error = checkBlacklist(path)
      if (error) return { error }
      const info = await readImageInfo(path)
      if (!info) return { error: `无法解析图片信息：${path}（文件不存在、非图片格式或文件损坏）` }
      return { path, format: info.format, width: info.width, height: info.height }
    }
  },
  {
    name: 'file_stat',
    label: '获取文件信息',
    description:
      '获取指定文件或目录的详细信息：大小（字节）、是否目录、是否文件、修改 / 创建 / 访问时间等。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件或目录路径' }
      },
      required: ['path']
    },
    risk: 'safe',
    handler: async (...params: unknown[]) => {
      const { path } = params[0] as { path: string }
      const error = checkBlacklist(path)
      if (error) return { error }
      try {
        return await window.preload.fs.stat(path)
      } catch {
        return { error: `无法获取文件信息：${path}（路径不存在或无法访问）` }
      }
    }
  },
  {
    name: 'file_glob',
    label: '匹配查找文件',
    description:
      '按 glob 模式递归查找文件，返回匹配的文件绝对路径列表（不含目录）。模式语法：** 匹配任意层级（如 **/*.vue 匹配所有 .vue 文件），* 匹配单层内任意字符（不含 /），? 匹配单个字符，{a,b} 多选一。自动忽略 node_modules/.git/dist 等目录；结果超上限会截断，请收窄模式后重试',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '搜索起始目录' },
        pattern: { type: 'string', description: 'glob 模式，如 **/*.vue、src/**/*.ts、*.{json,md}' }
      },
      required: ['path', 'pattern']
    },
    risk: 'safe',
    handler: async (...params: unknown[]) => {
      const { path, pattern } = params[0] as { path: string; pattern: string }
      const error = checkBlacklist(path)
      if (error) return { error }
      if (!window.preload.fs.existsSync(path)) return { error: `目录不存在：${path}` }
      try {
        return await window.preload.fs.glob({ path, pattern })
      } catch (e) {
        return { error: `查找文件失败：${e instanceof Error ? e.message : String(e)}` }
      }
    }
  },
  {
    name: 'file_grep',
    label: '搜索文件内容',
    description:
      '在指定目录下递归搜索文件内容（正则表达式逐行匹配），返回文件路径、行号与该行内容。可用 include 按文件名过滤（如 *.ts）。只搜索文本文件（跳过二进制与超大文件），自动忽略 node_modules/.git/dist 等目录；结果超上限会截断，请收窄 pattern 或 include 后重试',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '搜索起始目录' },
        pattern: { type: 'string', description: '要搜索的正则表达式' },
        include: { type: 'string', description: '文件名 glob 过滤（如 *.ts、*.vue），可选' },
        ignoreCase: { type: 'boolean', description: '是否忽略大小写，默认 false' }
      },
      required: ['path', 'pattern']
    },
    risk: 'safe',
    handler: async (...params: unknown[]) => {
      const { path, pattern, include, ignoreCase } = params[0] as {
        path: string
        pattern: string
        include?: string
        ignoreCase?: boolean
      }
      const error = checkBlacklist(path)
      if (error) return { error }
      if (!window.preload.fs.existsSync(path)) return { error: `目录不存在：${path}` }
      try {
        return await window.preload.fs.grep({ path, pattern, include, ignoreCase })
      } catch (e) {
        return { error: `搜索文件内容失败：${e instanceof Error ? e.message : String(e)}` }
      }
    }
  }
]
