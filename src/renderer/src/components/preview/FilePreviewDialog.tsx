import { h } from 'vue'
import { DialogPlugin, Button } from 'tdesign-vue-next'
import { MessageUtil } from '@/utils/modal'
import FilePreviewContent, { type FilePreviewKind } from './FilePreviewContent.vue'
import { openLinkPreview } from './LinkPreviewDrawer'

export interface FilePreviewItem {
  /** 展示标题；缺省取文件名 / URL */
  fileName?: string
  /** 本地文件绝对路径：与 url 二选一 */
  fullPath?: string
  /** http(s) 链接：与 fullPath 二选一（url 优先），命中走内嵌网页预览抽屉 */
  url?: string
}

/** 文件类型分组（供图标选择等消费方复用；html 仍属 code 组，仅预览分发时提前路由到渲染分支） */
export const CODE_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.vue',
  '.json',
  '.css',
  '.less',
  '.html',
  '.py',
  '.rs',
  '.go',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.yaml',
  '.yml',
  '.toml',
  '.xml',
  '.sh',
  '.bat',
  '.cmd',
  '.sql',
  '.rb',
  '.php',
  '.swift',
  '.kt',
  '.dart',
  '.scss',
  '.sass',
  '.styl',
  '.pl',
  '.lua',
  '.r',
  '.groovy',
  '.tex',
  '.ini',
  '.cfg',
  '.conf',
  '.env',
  '.gradle',
  '.tf'
])

export const IMAGE_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.ico',
  '.bmp',
  '.avif'
])

export const VIDEO_EXTS = new Set(['.mp4', '.webm', '.avi', '.mov', '.mkv', '.wmv', '.flv'])

export const AUDIO_EXTS = new Set([
  '.mp3',
  '.wav',
  '.ogg',
  '.flac',
  '.aac',
  '.wma',
  '.m4a',
  '.opus'
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
  '.tf': 'hcl'
}

export function getExt(path: string) {
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

interface PreviewDialogOptions {
  fileName: string
  fullPath: string
  /** 弹窗宽度，缺省 '80vw'（audio 用 '480px'） */
  width?: string
  kind: FilePreviewKind
  content?: string
  src?: string
  language?: string
}

function openPreviewDialog(options: PreviewDialogOptions) {
  DialogPlugin({
    header: options.fileName,
    placement: 'center',
    width: options.width ?? '80vw',
    footer: () => renderFooter(options.fullPath),
    destroyOnClose: true,
    body: () =>
      h(FilePreviewContent, {
        kind: options.kind,
        fileName: options.fileName,
        fullPath: options.fullPath,
        content: options.content,
        src: options.src,
        language: options.language
      })
  })
}

async function readTextOrToast(fullPath: string): Promise<string | null> {
  try {
    return await window.preload.fs.readTextFile(fullPath)
  } catch {
    MessageUtil.error('无法读取文件')
    return null
  }
}

export async function openFilePreview(item: FilePreviewItem) {
  if (item.url) {
    openLinkPreview(item.url)
    return
  }
  if (!item.fullPath) return
  const ext = getExt(item.fullPath)
  const fileName = item.fileName ?? window.preload.path.basename(item.fullPath)
  const { fullPath } = item

  if (ext === '.md') {
    const content = await readTextOrToast(fullPath)
    if (content === null) return
    openPreviewDialog({ fileName, fullPath, kind: 'markdown', content })
    return
  }

  // 本地 html：渲染预览优先（webview 无 partition，走默认 session 才能命中 mistrelle:// 协议），
  // 源码切换在内容组件内按需读取
  if (ext === '.html' || ext === '.htm') {
    openLinkPreview(window.preload.net.pathToFileHref(fullPath))
    return
  }

  if (CODE_EXTS.has(ext)) {
    const content = await readTextOrToast(fullPath)
    if (content === null) return
    openPreviewDialog({
      fileName,
      fullPath,
      kind: 'code',
      content,
      language: EXT_LANG[ext] || 'plaintext'
    })
    return
  }

  if (IMAGE_EXTS.has(ext)) {
    openPreviewDialog({
      fileName,
      fullPath,
      kind: 'image',
      src: window.preload.net.pathToHref(fullPath)
    })
    return
  }

  if (VIDEO_EXTS.has(ext)) {
    openPreviewDialog({
      fileName,
      fullPath,
      kind: 'video',
      src: window.preload.net.pathToHref(fullPath)
    })
    return
  }

  if (AUDIO_EXTS.has(ext)) {
    openPreviewDialog({
      fileName,
      fullPath,
      kind: 'audio',
      width: '480px',
      src: window.preload.net.pathToHref(fullPath)
    })
    return
  }

  showInFolder(fullPath)
}
