/**
 * 本地事件服务（main 进程，express）：127.0.0.1:47743，只绑回环。
 * 1. 资源面：渲染层经 pathToHref 生成的 GET /file/<encodeURIComponent(绝对路径)> 读盘返回
 *    （字体 / 图片等子资源；dev 下 http 页面加载 file:// 会被 Chromium 拦截，统一走本服务）。
 * 2. 事件面：外部进程（如 opencode 接入插件）GET|POST /buddy/event?platform=…&event=… 投递事件，
 *    零校验纯转发——完整原始事件发布到原始事件总线（publishRawBuddyEvent），监听器各取所需：
 *    白名单过滤（buddyEventFilter，命中发布校验后总线供设备消费）与集成调试事件流
 *    （integrationsActivity，全量转发伙伴窗口）。
 * 3. 图标面：GET /icon/app?path=<enc 应用路径> 返回应用图标 PNG（appIcon 提取落缓存），
 *    供「打开应用」下拉渲染（渲染层无法直接读盘取图标）。
 * 4. 权限面（接入适配）：/buddy/permission/ask|replied|decide，thin 转调权限审批基座
 *    （$/buddy/permission/permissionService）：ask 挂起等决定、replied 撤下原生侧已答项、
 *    decide 供外部脚本（如键盘执行脚本动作 / curl）回传允许/拒绝。
 * 处理逻辑单份、参数方案单份（platform/event query；权限面 JSON body）；不经系统唤起、结构性不抢焦点。
 * 详见 docs/server/01-event-server.md 与 docs/hardware/05、docs/hardware/08。
 */
import { app } from 'electron'
import express from 'express'
import type { Request, Response } from 'express'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { EVENT_SERVER_ORIGIN } from '@common/server/eventServer'
import { isPermissionDecision } from '@common/types/permissionRequest'
import { publishRawBuddyEvent } from '$/buddy/events/buddyEventBus'
import { cancelPermission, decidePermission, ingestPermission } from '$/buddy/permission/permissionService'
import { iconPngForApp } from '$/modules/appIcon'

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

/** 图标面：/icon/app?path=<enc 绝对路径> 返回应用图标 PNG（提取落缓存，失败 404 前端回退占位） */
const sendAppIcon = async (req: Request, res: Response): Promise<void> => {
  if (!allowedOrigin(req.headers.origin)) {
    res.status(403).end()
    return
  }
  try {
    const appPath = String(req.query.path ?? '')
    const png = appPath ? await iconPngForApp(appPath) : null
    if (!png) {
      res.status(404).end()
      return
    }
    res.set('Content-Type', 'image/png')
    res.set('Access-Control-Allow-Origin', '*')
    res.set('Cache-Control', 'public, max-age=86400')
    res.status(200).send(png)
  } catch {
    res.status(404).end()
  }
}

/** 事件面：/buddy/event?platform=<软件>&event=<Buddy 事件>；零校验纯转发，对外静默 204，未知路由 404 */
const dispatchEvent = (req: Request, res: Response): void => {
  if (req.path === '/buddy/event') {
    const platform = String(req.query.platform ?? '')
    const event = String(req.query.event ?? '')
    void publishRawBuddyEvent(platform, event)
    res.status(204).end()
    return
  }
  res.status(404).end()
}

const readString = (value: unknown): string => (typeof value === 'string' ? value : '')

/**
 * 权限面 /ask：接入方投递待审批请求（JSON body + ?source=），挂起至基座结算后回 {status}。
 * 客户端提前断开（崩溃 / 兜底超时中止）即撤下挂起项，避免面板残留幽灵请求。
 */
const askPermission = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Record<string, unknown>
  const permissionId = readString(body.permissionId)
  const sessionID = readString(body.sessionID)
  if (!permissionId || !sessionID) {
    res.status(400).end()
    return
  }
  const source = String(req.query.source ?? '') || 'unknown'
  const pattern = readString(body.pattern) || (Array.isArray(body.pattern) ? body.pattern.map(String) : undefined)
  let settled = false
  const requestId = `${sessionID}/${permissionId}`
  // 客户端断连检测必须挂 res（Node ≥16 的 req 'close' 在 body 读完后即触发，会误杀挂起项）；
  // writableEnded=false 的 close = 响应未完成连接就断了 → 撤下待审项防幽灵条目
  res.once('close', () => {
    if (settled || res.writableEnded) return
    settled = true
    cancelPermission(requestId)
  })
  const status = await ingestPermission(
    {
      requestId,
      permissionId,
      sessionID,
      type: readString(body.type),
      title: readString(body.title),
      pattern,
      callID: readString(body.callID) || undefined,
      createdAt: typeof body.createdAt === 'number' ? body.createdAt : Date.now()
    },
    source
  )
  settled = true
  res.json({ status })
}

/** 权限面 /replied：接入方原生侧已先行回答，撤下对应待审项（幂等，静默 204） */
const repliedPermission = (req: Request, res: Response): void => {
  const body = req.body as Record<string, unknown>
  const requestId = readString(body.requestId)
  if (requestId) cancelPermission(requestId)
  res.status(204).end()
}

/** 权限面 /decide：外部消费者（脚本 / curl）回传审批决定；命中 204、无此待审项 404、参数非法 400 */
const decideHttpPermission = (req: Request, res: Response): void => {
  const body = req.body as Record<string, unknown>
  const requestId = readString(body.requestId)
  const decision = readString(body.decision)
  if (!requestId || !isPermissionDecision(decision)) {
    res.status(400).end()
    return
  }
  res.status(decidePermission(requestId, decision) ? 204 : 404).end()
}

/** app ready 后调用：启动本地事件服务（先于建窗，保证渲染层资源面可用） */
export const startEventServer = (): void => {
  const server = express()
  server.disable('x-powered-by')

  server.get('/ping', (_req: Request, res: Response) => res.status(204).end())
  server.get('/file/*splat', (req: Request, res: Response) => {
    void sendFile(req, res)
  })
  server.get('/icon/app', (req: Request, res: Response) => {
    void sendAppIcon(req, res)
  })
  server.post('/buddy/permission/ask', express.json(), (req: Request, res: Response) => {
    void askPermission(req, res)
  })
  server.post('/buddy/permission/replied', express.json(), (req: Request, res: Response) => {
    repliedPermission(req, res)
  })
  server.post('/buddy/permission/decide', express.json(), (req: Request, res: Response) => {
    decideHttpPermission(req, res)
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
