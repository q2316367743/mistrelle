#!/usr/bin/env node
/**
 * ffmpeg 二进制拉取：从 npmmirror 镜像（ffmpeg-static b6.1.1）下载各平台裸二进制到
 * resources/ffmpeg/{os}-{arch}/，供 electron-builder extraResources 按平台打入安装包。
 *
 * 用法：node scripts/fetch-ffmpeg.mjs [--force]
 * 产物缓存于 ~/.mistrelle/cache/ffmpeg/b6.1.1/，重复执行幂等（已存在跳过）。
 */
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chmodSync, copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'

const VERSION = '6.1.1'
// 默认走 npmmirror 国内镜像；FFMPEG_MIRROR 可覆盖（如切回 GitHub 官方 release）
const MIRROR = process.env.FFMPEG_MIRROR ?? 'https://registry.npmmirror.com/-/binary/ffmpeg-static'

const PLATFORMS = [
  ['darwin', 'x64'],
  ['darwin', 'arm64'],
  ['win32', 'x64'],
  ['linux', 'x64'],
  ['linux', 'arm64']
]

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CACHE_DIR = join(homedir(), '.mistrelle', 'cache', 'ffmpeg', `b${VERSION}`)
const force = process.argv.includes('--force')

const download = async (url, target) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}: ${url}`)
  mkdirSync(dirname(target), { recursive: true })
  await writeFile(target, Buffer.from(await res.arrayBuffer()))
}

for (const [os, arch] of PLATFORMS) {
  const label = `${os}-${arch}`
  // 镜像资产名不带 .exe 后缀，落盘时按平台命名
  const dest = join(ROOT, 'resources/ffmpeg', label, os === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  if (!force && existsSync(dest)) {
    console.log(`跳过 ${label}（已存在）`)
    continue
  }
  const cache = join(CACHE_DIR, `ffmpeg-${os}-${arch}`)
  if (force || !existsSync(cache)) {
    await download(`${MIRROR}/b${VERSION}/ffmpeg-${os === 'darwin' ? 'mac' : os}-${arch}`, cache)
    console.log(`已下载 ${label}`)
  }
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(cache, dest)
  if (os !== 'win32') chmodSync(dest, 0o755)
  // 异平台产物无法在本机执行，信任镜像完整性；当前平台做 -version 校验
  if (os === process.platform && arch === process.arch) {
    const res = spawnSync(dest, ['-version'], { timeout: 10000 })
    if (res.status !== 0) throw new Error(`${label} 校验失败（-version 无响应）`)
    console.log(`已校验 ${label}`)
  }
  console.log(`✓ ${label} → ${dest}`)
}

console.log('全部平台就绪，可执行打包（npm run build:mac / build:win / build:linux）')
