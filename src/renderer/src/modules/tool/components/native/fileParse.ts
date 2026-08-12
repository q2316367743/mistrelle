import type { ToolFunction } from '@/domain'
import { useSettingSecureStore } from '@/store/setting/SettingSecureStore'
import { isPathBlacklisted } from '@/utils/sandbox'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { PDFParse } from 'pdf-parse'

/** 提取后文本最大字符数，超出截断并附注 */
const MAX_CONTENT_LENGTH = 80_000

function checkBlacklist(path: string): string | null {
  const store = useSettingSecureStore()
  const { sandbox } = store.state
  if (sandbox.enabled && sandbox.fileBlackList && isPathBlacklisted(path, sandbox.fileBlackList)) {
    return `路径 ${path} 在黑名单中，已被安全策略拦截`
  }
  return null
}

/** 截断过长文本并附注提示 */
function truncateContent(content: string): string {
  if (content.length <= MAX_CONTENT_LENGTH) return content
  return content.slice(0, MAX_CONTENT_LENGTH) + `\n\n[内容过长，已截断，原文共 ${content.length} 字符]`
}

// ─── 解析函数 ───────────────────────────────────────────────

async function parseDocx(path: string): Promise<string> {
  const arrayBuffer = await window.preload.fs.readBinaryFile(path)
  const result = await mammoth.convertToHtml({ arrayBuffer })
  // 简单将 HTML 转为更易读的纯文本：去除标签，保留段落换行
  const text = result.value
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return truncateContent(text)
}

async function parseXlsx(path: string, sheet?: string, range?: string): Promise<string> {
  const arrayBuffer = await window.preload.fs.readBinaryFile(path)
  const data = new Uint8Array(arrayBuffer)
  const workbook = XLSX.read(data, { type: 'array' })

  // 确定目标 sheet
  let sheetName: string | undefined
  if (sheet !== undefined) {
    // 支持按名称或按索引（数字字符串）
    const index = Number(sheet)
    if (!Number.isNaN(index) && index >= 0 && index < workbook.SheetNames.length) {
      sheetName = workbook.SheetNames[index]
    } else {
      sheetName = workbook.SheetNames.find((name) => name === sheet)
    }
    if (!sheetName) {
      return `错误：未找到工作表「${sheet}」，可用工作表：${workbook.SheetNames.join(', ')}`
    }
  }

  // 未指定 sheet 时导出全部（多 sheet 以标题分隔）
  const targetSheets = sheetName ? [sheetName] : workbook.SheetNames
  const parts: string[] = []

  for (const name of targetSheets) {
    const worksheet = workbook.Sheets[name]
    if (!worksheet) continue
    // 通过临时修改 !ref 限定输出范围
    const originalRef = worksheet['!ref']
    if (range) worksheet['!ref'] = range
    const csv = XLSX.utils.sheet_to_csv(worksheet)
    if (range) worksheet['!ref'] = originalRef
    const header = targetSheets.length > 1 ? `## Sheet: ${name}\n` : ''
    parts.push(`${header}${csv}`)
  }

  return truncateContent(parts.join('\n\n'))
}

async function parsePdf(path: string, pages?: string): Promise<string> {
  const arrayBuffer = await window.preload.fs.readBinaryFile(path)
  const data = new Uint8Array(arrayBuffer)
  const parser = new PDFParse({ data })

  try {
    // 解析 pages 参数，支持 "1-5" / "1,3,5" / "3" 格式
    let partial: number[] | undefined
    if (pages) {
      partial = []
      for (const segment of pages.split(',')) {
        const trimmed = segment.trim()
        const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/)
        if (rangeMatch) {
          const start = Number(rangeMatch[1])
          const end = Number(rangeMatch[2])
          for (let i = start; i <= end; i++) partial.push(i)
        } else {
          const num = Number(trimmed)
          if (!Number.isNaN(num) && num > 0) partial.push(num)
        }
      }
      if (partial.length === 0) partial = undefined
    }

    const result = await parser.getText(partial ? { partial } : undefined)
    return truncateContent(result.text)
  } finally {
    await parser.destroy()
  }
}

// ─── 写入函数 ───────────────────────────────────────────────

interface SheetMerge {
  start: [number, number]
  end: [number, number]
}

interface SheetInput {
  name: string
  data: (string | number)[][]
  merges?: SheetMerge[]
}

async function writeXlsx(path: string, sheets: SheetInput[]): Promise<void> {
  const workbook = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.data)
    if (sheet.merges && sheet.merges.length > 0) {
      worksheet['!merges'] = sheet.merges.map((m) => ({
        s: { r: m.start[0], c: m.start[1] },
        e: { r: m.end[0], c: m.end[1] }
      }))
    }
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  }
  const arrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  await window.preload.fs.writeBinaryFile(path, arrayBuffer)
}

// ─── Tool 定义 ──────────────────────────────────────────────

export const fileParseTools: ToolFunction[] = [
  {
    name: 'file_read_docx',
    label: '读取 Word 文档',
    description: '读取 .docx 格式的 Word 文档，提取为纯文本内容',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '要读取的 .docx 文件路径' }
      },
      required: ['path']
    },
    risk: 'safe',
    handler: async (...params: unknown[]) => {
      const { path } = params[0] as { path: string }
      const error = checkBlacklist(path)
      if (error) return { error }
      const content = await parseDocx(path)
      return { content }
    }
  },
  {
    name: 'file_read_xlsx',
    label: '读取 Excel 表格',
    description: '读取 .xlsx/.xls 格式的 Excel 文件，以 CSV 格式返回表格数据。可指定工作表名称/索引和单元格范围',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '要读取的 Excel 文件路径' },
        sheet: { type: 'string', description: '工作表名称或索引（从 0 开始），不指定则读取全部工作表' },
        range: { type: 'string', description: '单元格范围（如 "A1:D20"），不指定则读取整个工作表' }
      },
      required: ['path']
    },
    risk: 'safe',
    handler: async (...params: unknown[]) => {
      const { path, sheet, range } = params[0] as { path: string; sheet?: string; range?: string }
      const error = checkBlacklist(path)
      if (error) return { error }
      const content = await parseXlsx(path, sheet, range)
      return { content }
    }
  },
  {
    name: 'file_read_pdf',
    label: '读取 PDF 文档',
    description: '读取 PDF 文件，提取为纯文本内容。可指定页码范围',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '要读取的 PDF 文件路径' },
        pages: { type: 'string', description: '页码范围，支持 "1-5"、"1,3,5"、"3" 等格式，不指定则读取全部页面' }
      },
      required: ['path']
    },
    risk: 'safe',
    handler: async (...params: unknown[]) => {
      const { path, pages } = params[0] as { path: string; pages?: string }
      const error = checkBlacklist(path)
      if (error) return { error }
      const content = await parsePdf(path, pages)
      return { content }
    }
  },
  {
    name: 'file_write_xlsx',
    label: '写入 Excel 表格',
    description: '创建或覆盖 .xlsx 文件，支持多工作表和单元格合并',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '要写入的 .xlsx 文件路径' },
        sheets: {
          type: 'array',
          description: '工作表列表',
          items: {
            type: 'object',
            description: '单个工作表',
            properties: {
              name: { type: 'string', description: '工作表名称' },
              data: {
                type: 'array',
                description: '二维数组，每个子数组为一行数据',
                items: { type: 'array', description: '一行数据', items: { type: 'string', description: '单元格值' } }
              },
              merges: {
                type: 'array',
                description: '合并区域列表，行列索引从 0 开始',
                items: {
                  type: 'object',
                  description: '合并区域',
                  properties: {
                    start: { type: 'array', description: '起始位置 [row, col]', items: { type: 'number', description: '索引' } },
                    end: { type: 'array', description: '结束位置 [row, col]', items: { type: 'number', description: '索引' } }
                  }
                }
              }
            },
            required: ['name', 'data']
          }
        }
      },
      required: ['path', 'sheets']
    },
    risk: 'sensitive',
    stripFields: ['sheets'],
    handler: async (...params: unknown[]) => {
      const { path, sheets } = params[0] as { path: string; sheets: SheetInput[] }
      const error = checkBlacklist(path)
      if (error) return { error }
      await writeXlsx(path, sheets)
      return { success: true }
    }
  }
]
