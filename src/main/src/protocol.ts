/**
 * mistrelle:// 自定义协议（main 进程）：让渲染进程用 URL 加载本地磁盘资源（字体 / 图片）。
 *
 * 背景：dev 模式渲染页 origin 为 http://localhost:7743，Chromium 禁止 http 页面加载 file:// 子资源
 * （Not allowed to load local resource）。自定义协议经 protocol.handle 由 main 读盘返回，无跨源限制，
 * 保留浏览器 / FontFace 缓存；纯进程内行为，不落盘、不注册系统级项，退出即消失。
 *
 * URL 约定：
 * - mistrelle://local/<encodeURIComponent(绝对路径)>  本地文件，由 preload 侧 net.pathToHref 生成
 */
import { protocol } from 'electron'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

const SCHEME = 'mistrelle'

/** 文件扩展名 → Content-Type（字体 / 图片 / 网页资源为主，其余回退通用类型） */
const MIME_BY_EXT: Record<string, string> = {
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.ttc': 'font/collection',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json'
}

const mimeOf = (filePath: string): string =>
  MIME_BY_EXT[extname(filePath).toLowerCase()] ?? 'application/octet-stream'

/** 在 app ready 之前调用：把 mistrelle 注册为标准 + 安全 scheme（可被 fetch 使用、突破 CSP 限制） */
export const registerLocalSchemes = (): void => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        bypassCSP: true
      }
    }
  ])
}

/** 在 app ready 之后调用：注册 mistrelle:// 处理，返回本地文件 */
export const registerLocalProtocol = (): void => {
  protocol.handle(SCHEME, async (request) => {
    try {
      const { pathname } = new URL(request.url)
      const filePath = decodeURIComponent(pathname.replace(/^\//, ''))
      const data = await readFile(filePath)
      return new Response(data, {
        headers: {
          'Content-Type': mimeOf(filePath),
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch {
      return new Response('Not Found', { status: 404 })
    }
  })
}
