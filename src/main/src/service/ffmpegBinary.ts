/**
 * ffmpeg 二进制管理：随安装包分发，运行时直接解析可执行路径，无远程下载。
 *
 * 二进制由 scripts/fetch-ffmpeg.mjs 从 npmmirror 镜像（ffmpeg-static 6.1.1）拉取到
 * resources/ffmpeg/{os}-{arch}/（gitignore 不入库）；electron-builder extraResources
 * 按平台注入安装包，详见 docs/build/03-ffmpeg-bundling.md。
 */
import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, chmodSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const FFMPEG_NAME = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'

/**
 * 内置 ffmpeg 路径：
 * - 打包后：extraResources 注入 process.resourcesPath/ffmpeg/
 * - dev：项目 resources/ffmpeg/{os}-{arch}/（需先跑 scripts/fetch-ffmpeg.mjs）
 */
const bundledFfmpegPath = (): string =>
  app.isPackaged
    ? join(process.resourcesPath, 'ffmpeg', FFMPEG_NAME)
    : join(__dirname, '../../resources/ffmpeg', `${process.platform}-${process.arch}`, FFMPEG_NAME)

/** 校验二进制可执行（-version 退出码为 0 即视为可用） */
const verifyBinary = (binaryPath: string): boolean => {
  try {
    const res = spawnSync(binaryPath, ['-version'], { timeout: 10000 })
    return res.status === 0
  } catch {
    return false
  }
}

/**
 * 确保 ffmpeg 可用，返回可执行文件绝对路径。
 * 二进制随包分发：缺失说明 fetch 脚本未跑或打包配置有误，直接抛错给出指引。
 */
export const ensureFfmpegBinary = (): string => {
  const binary = bundledFfmpegPath()
  if (!existsSync(binary)) {
    throw new Error(`ffmpeg 二进制缺失（${binary}），请先运行 node scripts/fetch-ffmpeg.mjs`)
  }
  if (process.platform !== 'win32') {
    // 安装目录可能只读，chmod 失败不致命：extraResources 拷贝通常已保留可执行位
    try {
      chmodSync(binary, 0o755)
    } catch {
      /* ignore */
    }
  }
  if (!verifyBinary(binary)) {
    throw new Error(`ffmpeg 校验失败（-version 无响应）：${binary}`)
  }
  return binary
}
