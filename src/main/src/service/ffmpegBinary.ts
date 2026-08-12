/**
 * ffmpeg 二进制管理：首次使用时远程下载到 ~/.mistrelle/extends，并持久化可执行路径。
 *
 * 下载源：ffbinaries-prebuilt v6.1（GitHub Releases），三平台统一命名：
 *   ffmpeg-6.1-{os}-{arch}.zip（macos-64 / win-64 / linux-64 / linux-arm-64）
 * Apple Silicon 无原生 arm64 构建，暂用 macos-64 走 Rosetta；URL 表独立成常量便于替换。
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, mkdirSync, chmodSync } from 'node:fs'
import { readFile, writeFile, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import axios from 'axios'
import AdmZip from 'adm-zip'

const EXTENDS_DIR = join(homedir(), '.mistrelle', 'extends')
const FFMPEG_FILE = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
const FFMPEG_PATH = join(EXTENDS_DIR, FFMPEG_FILE)
const META_PATH = join(EXTENDS_DIR, 'ffmpeg.json')

const FFMPEG_VERSION = '6.1'

/** 按平台解析下载文件名；返回 null 表示当前平台不支持 */
const resolveAssetName = (): string | null => {
  switch (process.platform) {
    case 'darwin':
      return `ffmpeg-${FFMPEG_VERSION}-macos-64.zip`
    case 'win32':
      return `ffmpeg-${FFMPEG_VERSION}-win-64.zip`
    case 'linux':
      return `ffmpeg-${FFMPEG_VERSION}-linux-${process.arch === 'arm64' ? 'arm-64' : '64'}.zip`
    default:
      return null
  }
}

const DOWNLOAD_URL = (asset: string): string =>
  `https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v${FFMPEG_VERSION}/${asset}`

/** 下载 zip 到临时文件（流式落盘，避免整体进内存） */
const downloadZip = async (url: string, target: string): Promise<void> => {
  const response = await axios({ url, adapter: 'http', responseType: 'stream' })
  await new Promise<void>((resolve, reject) => {
    const file = createWriteStream(target)
    response.data.pipe(file)
    file.on('finish', () => {
      file.close()
      resolve()
    })
    file.on('error', reject)
    response.data.on('error', reject)
  })
}

/** 校验二进制可执行（-version 退出码为 0 即视为可用） */
const verifyBinary = (binaryPath: string): boolean => {
  try {
    const res = spawnSync(binaryPath, ['-version'], { timeout: 10000 })
    return res.status === 0
  } catch {
    return false
  }
}

const writeMeta = async (binaryPath: string): Promise<void> => {
  await writeFile(
    META_PATH,
    JSON.stringify(
      { version: FFMPEG_VERSION, path: binaryPath, downloadedAt: Date.now() },
      null,
      2
    ),
    'utf-8'
  )
}

/**
 * 确保 ffmpeg 可用，返回可执行文件绝对路径。
 * 二进制缺失时：下载 → 解压 → chmod +x → -version 校验 → 写 meta。
 */
export const ensureFfmpegBinary = async (): Promise<string> => {
  if (existsSync(FFMPEG_PATH) && verifyBinary(FFMPEG_PATH)) {
    return FFMPEG_PATH
  }
  const asset = resolveAssetName()
  if (!asset) throw new Error(`当前平台（${process.platform}/${process.arch}）暂不支持 ffmpeg 自动下载`)
  mkdirSync(EXTENDS_DIR, { recursive: true })

  const zipPath = join(EXTENDS_DIR, asset)
  await downloadZip(DOWNLOAD_URL(asset), zipPath)
  try {
    // ffbinaries 的 zip 根目录即可执行文件
    const zip = new AdmZip(zipPath)
    zip.extractAllTo(EXTENDS_DIR, true)
  } finally {
    await rm(zipPath, { force: true }).catch(() => {})
  }
  if (process.platform !== 'win32') chmodSync(FFMPEG_PATH, 0o755)
  if (!verifyBinary(FFMPEG_PATH)) {
    throw new Error('ffmpeg 下载完成但校验失败（-version 无响应），请检查网络或手动放置二进制到 ~/.mistrelle/extends')
  }
  await writeMeta(FFMPEG_PATH)
  return FFMPEG_PATH
}

/** 已下载的 ffmpeg 可执行路径（未下载返回 null，不触发下载） */
export const getFfmpegPath = async (): Promise<string | null> => {
  try {
    const meta = JSON.parse(await readFile(META_PATH, 'utf-8')) as { path?: string }
    if (meta.path && existsSync(meta.path)) return meta.path
  } catch {
    // meta 缺失 / 损坏：视为未下载
  }
  return null
}
