/**
 * 本地事件服务（main 进程，express）：127.0.0.1:47743，只绑回环。
 * 1. 资源面：渲染层经 pathToHref 生成的 GET /file/<encodeURIComponent(绝对路径)> 读盘返回
 *    （字体 / 图片等子资源；dev 下 http 页面加载 file:// 会被 Chromium 拦截，统一走本服务）。
 * 2. 事件面：外部进程（如 opencode 接入插件）GET|POST /buddy/event?platform=…&event=… 投递事件，
 *    只做协议校验（platform/event 双白名单）后经 buddyEventBus 发布；业务消费方在各自域服务
 *    init 内 subscribe（红绿灯 / ESP32 LCD 等），本模块零业务依赖。
 * 处理逻辑单份、参数方案单份（platform/event query）；不经系统唤起、结构性不抢焦点。
 * 详见 docs/server/01-event-server.md 与 docs/hardware/05。
 */
import { app } from 'electron'
import express from 'express'
import type { Request, Response } from 'express'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { EVENT_SERVER_ORIGIN } from '@common/server/eventServer'
import { isBuddyEvent } from '@common/types/buddyEvent'
import { isSoftwareName } from '@common/types/trafficLight'
import { publishBuddyEvent } from '$/buddy/events/buddyEventBus'

const HOST = '127.0.0.1'
const PORT = Number(new URL(EVENT_SERVER_ORIGIN).port)

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

/**
 * Origin 守卫：本应用渲染页（dev origin / 生产 file:// 的 null Origin）与无 Origin 请求放行；
 * 其余（浏览器网页等）拒绝，防公网页面经本机回环 drive-by 读盘。
 */
const allowedOrigin = (origin: string | undefined): boolean =>
  origin === undefined ||
  origin === 'null' ||
  origin === 'http://localhost:7743' ||
  origin === 'http://127.0.0.1:7743'

/** 资源面：/file/<enc 绝对路径> 读盘返回；无 Range 分片（字体 / 图片全量即可） */
const sendFile = async (req: Request, res: Response): Promise<void> => {
  if (!allowedOrigin(req.headers.origin)) {
    res.status(403).end()
    return
  }
  try {
    const filePath = decodeURIComponent(req.path.slice('/file/'.length))
    const data = await readFile(filePath)
    res.set('Content-Type', mimeOf(filePath))
    res.set('Access-Control-Allow-Origin', '*')
    res.status(200).send(data)
  } catch {
    res.status(404).end()
  }
}

/** 事件面：/buddy/event?platform=<软件>&event=<Buddy 事件>；非法参数静默 204，未知路由 404 */
const dispatchEvent = (req: Request, res: Response): void => {
  console.info(`[server] 收到事件：${req.originalUrl}`)
  if (req.path === '/buddy/event') {
    const platform = String(req.query.platform ?? '')
    const event = String(req.query.event ?? '')
    if (isSoftwareName(platform) && isBuddyEvent(event)) {
      void publishBuddyEvent(platform, event)
    }
    res.status(204).end()
    return
  }
  res.status(404).end()
}

/** app ready 后调用：启动本地事件服务（先于建窗，保证渲染层资源面可用） */
export const startEventServer = (): void => {
  const server = express()
  server.disable('x-powered-by')

  server.get('/ping', (_req: Request, res: Response) => res.status(204).end())
  server.get('/file/*splat', (req: Request, res: Response) => {
    void sendFile(req, res)
  })
  server.use((req: Request, res: Response) => dispatchEvent(req, res))

  const httpServer = server.listen(PORT, HOST, () => {
    console.info(`[server] 本地事件服务已启动：${EVENT_SERVER_ORIGIN}`)
  })
  httpServer.on('error', (error) => {
    console.error(`[server] 本地事件服务启动失败：${String(error)}`)
  })
  app.once('will-quit', () => httpServer.close())
}
