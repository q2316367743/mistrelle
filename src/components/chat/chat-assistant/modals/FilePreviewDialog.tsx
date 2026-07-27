import { ref } from 'vue'
import { DialogPlugin, Button, TabPanel, Table, Tabs } from 'tdesign-vue-next'
import { ChatContent } from '@tdesign-vue-next/chat'
import { MessageUtil } from '@/utils/modal'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import MonacoEditorView from '@/components/view/MonacoEditorView.vue'

export interface ProductFile {
  fileName: string
  fullPath: string
}

const CODE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.vue', '.json', '.css', '.less', '.html',
  '.py', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.hpp', '.yaml', '.yml',
  '.toml', '.xml', '.sh', '.bat', '.cmd', '.sql', '.rb', '.php',
  '.swift', '.kt', '.dart', '.scss', '.sass', '.styl', '.pl', '.lua', '.r',
  '.groovy', '.tex', '.ini', '.cfg', '.conf', '.env', '.gradle', '.tf',
])

const IMAGE_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.avif',
])

const VIDEO_EXTS = new Set([
  '.mp4', '.webm', '.avi', '.mov', '.mkv', '.wmv', '.flv',
])

const AUDIO_EXTS = new Set([
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma', '.m4a', '.opus',
])

const EXT_LANG: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.vue': 'html',
  '.json': 'json',
  '.css': 'css',
  '.less': 'less',
  '.html': 'html',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'ini',
  '.xml': 'xml',
  '.sh': 'shell',
  '.bat': 'bat',
  '.sql': 'sql',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.dart': 'dart',
  '.scss': 'scss',
  '.sass': 'scss',
  '.styl': 'stylus',
  '.pl': 'perl',
  '.lua': 'lua',
  '.r': 'r',
  '.groovy': 'groovy',
  '.tex': 'latex',
  '.ini': 'ini',
  '.cfg': 'ini',
  '.conf': 'ini',
  '.gradle': 'groovy',
  '.tf': 'hcl',
}

function getExt(path: string) {
  const i = path.lastIndexOf('.')
  return i >= 0 ? path.slice(i).toLowerCase() : ''
}

function openPath(path: string) {
  window.preload.inject.shell.openPath(path)
}
function showInFolder(path: string) {
  window.preload.inject.shell.showItemInFolder(path)
}

function renderFooter(path: string) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        marginTop: 'var(--td-comp-margin-l)'
      }}
    >
      <Button theme={'primary'} variant="outline" onClick={() => openPath(path)}>
        使用默认程序打开
      </Button>
      <Button variant="outline" onClick={() => showInFolder(path)}>
        在文件夹中显示
      </Button>
    </div>
  )
}

async function openMarkdownPreview(file: ProductFile) {
  let content: string
  try {
    content = await window.preload.fs.readTextFile(file.fullPath)
  } catch {
    MessageUtil.error('无法读取文件')
    return
  }

  const mode = ref<'preview' | 'source'>('preview')

  DialogPlugin({
    header: () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span>{file.fileName}</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <Button
            size="small"
            variant={mode.value === 'preview' ? 'base' : 'text'}
            onClick={() => (mode.value = 'preview')}
          >
            预览
          </Button>
          <Button
            size="small"
            variant={mode.value === 'source' ? 'base' : 'text'}
            onClick={() => (mode.value = 'source')}
          >
            源码
          </Button>
        </div>
      </div>
    ),
    placement: 'center',
    width: '70vw',
    footer: () => renderFooter(file.fullPath),
    default: () => (
      <div style={{ width: 'calc(100% - 2px)' }}>
        {mode.value === 'preview' ? (
          <div style={{ maxHeight: '60vh', overflow: 'auto', padding: '4px 0' }}>
            <ChatContent content={content} />
          </div>
        ) : (
          <MonacoEditorView value={content} language="markdown" height="60vh" minimap={false} />
        )}
      </div>
    )
  })
}

async function openCodePreview(file: ProductFile) {
  let content: string
  try {
    content = await window.preload.fs.readTextFile(file.fullPath)
  } catch {
    MessageUtil.error('无法读取文件')
    return
  }
  const ext = getExt(file.fullPath)
  const lang = EXT_LANG[ext] || 'plaintext'

  DialogPlugin({
    header: file.fileName,
    placement: 'center',
    width: '70vw',
    footer: () => renderFooter(file.fullPath),
    default: () => (
      <div style={{ width: 'calc(100% - 2px)' }}>
        <MonacoEditorView value={content} language={lang} height="60vh" minimap={false} />
      </div>
    )
  })
}

function openImagePreview(file: ProductFile) {
  const src = window.preload.net.pathToHref(file.fullPath)
  DialogPlugin({
    header: file.fileName,
    placement: 'center',
    width: '70vw',
    footer: () => renderFooter(file.fullPath),
    default: () => (
      <div style={{ textAlign: 'center' }}>
        <img
          src={src}
          alt={file.fileName}
          style={{
            maxWidth: '100%',
            maxHeight: '60vh',
            objectFit: 'contain',
            borderRadius: 'var(--td-radius-medium)'
          }}
        />
      </div>
    )
  })
}

function openVideoPreview(file: ProductFile) {
  const src = window.preload.net.pathToHref(file.fullPath)
  DialogPlugin({
    header: file.fileName,
    placement: 'center',
    width: '70vw',
    footer: () => renderFooter(file.fullPath),
    default: () => (
      <div style={{ textAlign: 'center' }}>
        <video
          src={src}
          controls
          style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 'var(--td-radius-medium)' }}
        />
      </div>
    )
  })
}

function openAudioPreview(file: ProductFile) {
  const src = window.preload.net.pathToHref(file.fullPath)
  DialogPlugin({
    header: file.fileName,
    placement: 'center',
    width: '480px',
    footer: () => renderFooter(file.fullPath),
    default: () => (
      <div style={{ textAlign: 'center', padding: 'var(--td-comp-paddingTB-xl) 0' }}>
        <audio src={src} controls style={{ width: '100%' }} />
      </div>
    )
  })
}

async function openDocxPreview(file: ProductFile) {
  let arrayBuffer: ArrayBuffer
  try {
    arrayBuffer = await window.preload.fs.readBinaryFile(file.fullPath)
  } catch {
    MessageUtil.error('无法读取文件')
    return
  }

  let html: string
  try {
    const result = await mammoth.convertToHtml({ arrayBuffer })
    html = result.value
  } catch {
    MessageUtil.error('文档解析失败')
    return
  }

  DialogPlugin({
    header: file.fileName,
    placement: 'center',
    width: '70vw',
    footer: () => renderFooter(file.fullPath),
    default: () => (
      <div>
        <div
          innerHTML={html}
          style={{
            maxHeight: '60vh',
            overflow: 'auto',
            padding: 'var(--td-comp-paddingTB-m) var(--td-comp-paddingLR-m)',
            background: '#fff',
            borderRadius: 'var(--td-radius-medium)'
          }}
        />
      </div>
    )
  })
}

async function openXlsxPreview(file: ProductFile) {
  let arrayBuffer: ArrayBuffer
  try {
    arrayBuffer = await window.preload.fs.readBinaryFile(file.fullPath)
  } catch {
    MessageUtil.error('无法读取文件')
    return
  }

  let workbook: XLSX.WorkBook
  try {
    const data = new Uint8Array(arrayBuffer)
    workbook = XLSX.read(data, { type: 'array' })
  } catch {
    MessageUtil.error('表格解析失败')
    return
  }

  const activeTab = ref(workbook.SheetNames[0])

  DialogPlugin({
    header: file.fileName,
    placement: 'center',
    width: '70vw',
    footer: () => renderFooter(file.fullPath),
    default: () => (
      <div style={{ width: 'calc(100% - 2px)' }}>
        <Tabs v-model={activeTab.value}>
          {workbook.SheetNames.map((name) => {
            const ws = workbook.Sheets[name]
            const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
            const headerRow = rows[0] ?? []
            const columns = headerRow.map((h, i) => ({
              colKey: `col_${i}`,
              title: h ?? `列${i + 1}`,
            }))
            const data = rows.slice(1).map((row, rowIdx) => {
              const item: Record<string, unknown> = { _index: rowIdx }
              columns.forEach((col, i) => {
                item[col.colKey] = row[i]
              })
              return item
            })
            return (
              <TabPanel key={name} label={name} value={name}>
                <Table
                  columns={columns as any}
                  data={data}
                  rowKey="_index"
                  bordered
                  stripe
                  hover
                  maxHeight="60vh"
                  tableLayout="auto"
                />
              </TabPanel>
            )
          })}
        </Tabs>
      </div>
    ),
  })
}

export function openFilePreview(file: ProductFile) {
  const ext = getExt(file.fullPath)

  if (ext === '.md') {
    openMarkdownPreview(file)
  } else if (CODE_EXTS.has(ext)) {
    openCodePreview(file)
  } else if (IMAGE_EXTS.has(ext)) {
    openImagePreview(file)
  } else if (VIDEO_EXTS.has(ext)) {
    openVideoPreview(file)
  } else if (AUDIO_EXTS.has(ext)) {
    openAudioPreview(file)
  } else if (ext === '.docx') {
    openDocxPreview(file)
  } else if (ext === '.xlsx' || ext === '.xls') {
    openXlsxPreview(file)
  } else {
    showInFolder(file.fullPath)
  }
}
