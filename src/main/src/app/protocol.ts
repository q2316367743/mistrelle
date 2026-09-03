/**
 * mistrelle:// 自定义协议（main 进程）：
 * 1. 应用内资源面：让渲染进程用 URL 加载本地磁盘资源（字体 / 图片），
 *    形式 mistrelle://app/file/<encodeURIComponent(绝对路径)>，由 preload 侧 net.pathToHref 生成。
 * 2. 系统级链接面：注册为 OS 默认协议客户端，外部应用 open mistrelle://… 可唤起本应用；
 *    URL 只被接收（second-instance / open-url → handleExternalUrl），不弹窗、不聚焦、不打扰 UI。
 *
 * 背景：dev 模式渲染页 origin 为 http://localhost:7743，Chromium 禁止 http 页面加载 file:// 子资源
 * （Not allowed to load local resource）。自定义协议经 protocol.handle 由 main 读盘返回，无跨源限制，
 * 保留浏览器 / FontFace 缓存；纯进程内行为，不落盘，退出即消失。
 *
 * URL 约定（/{模块}/{功能}）：
 * - mistrelle://app/file/<encodeURIComponent(绝对路径)>  本地文件读盘（应用内资源面）
 * - mistrelle://app/<模块>/<功能>?…                       系统级外部命令面（路由桩，待后续接入）
 * - mistrelle://buddy/traffic-light?platform=<软件>&event=<事件>  红绿灯事件投递（如 opencode 插件）
 */
import { app, protocol } from 'electron'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { applyEvent } from '$/buddy/traffic-light/TrafficLightService'

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

const notFound = (): Response => new Response('Not Found', { status: 404 })

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

/**
 * 协议分发：仅处理 mistrelle://app/file/<enc 绝对路径> 读盘（应用内资源面）。
 * host 非 app 或模块非 file 一律 404；系统级外部命令面不在此分发（走 handleExternalUrl → routeExternalCommand）。
 */
const dispatchRequest = async (url: string): Promise<Response> => {
  const { hostname, pathname } = new URL(url)
  if (hostname !== 'app') return notFound()
  const [, module, ...rest] = pathname.split('/')
  if (module !== 'file') return notFound()
  const filePath = decodeURIComponent(rest.join('/'))
  const data = await readFile(filePath)
  return new Response(data, {
    headers: {
      'Content-Type': mimeOf(filePath),
      'Access-Control-Allow-Origin': '*'
    }
  })
}

/** 在 app ready 之后调用：注册 mistrelle:// 处理，返回本地文件 */
export const registerLocalProtocol = (): void => {
  protocol.handle(SCHEME, async (request) => {
    try {
      return await dispatchRequest(request.url)
    } catch {
      return notFound()
    }
  })
}

/**
 * 外部 mistrelle:// URL 接收入口（系统级唤起 / 二次唤起共用）：
 * 只消费 URL，不弹窗、不聚焦、不改 UI 状态；当前仅记录并进路由桩，
 * 后续命令/事件接入（如 opencode → traffic-light）在此挂分发表。
 */
export const handleExternalUrl = (url: string): void => {
  console.info(`[mistrelle://] 收到外部唤起：${url}`)
  routeExternalCommand(url)
}

/**
 * 外部命令路由：mistrelle://<模块>/<功能>?…
 * - buddy/traffic-light：红绿灯事件投递，按 platform/event 交给 applyEvent
 *   （软件未启用/事件未知/未绑定/串口未连接在 applyEvent 内静默忽略）
 * - app/…：预留命令面（待接入）
 */
const routeExternalCommand = (url: string): void => {
  try {
    const { hostname, pathname, searchParams } = new URL(url)
    if (hostname === 'buddy' && pathname === '/traffic-light') {
      void applyEvent(searchParams.get('platform') ?? '', searchParams.get('event') ?? '')
      return
    }
    if (hostname !== 'app') return
    // TODO: 命令分发表（mistrelle://app/<模块>/<action>?…）
  } catch {
    // URL 非法：忽略
  }
}

/** macOS open-url 可能在 app ready 前触发：暂存，ready 后经 registerDeepLink flush */
const pendingUrls: string[] = []

/**
 * 在 app ready 之前调用：挂 macOS open-url 监听，接收系统级唤起 URL。
 * ready 前的事件先入 pendingUrls，ready 后统一 flush 到 handleExternalUrl。
 */
export const captureOpenUrl = (): void => {
  app.on('open-url', (event, url) => {
    event.preventDefault()
    if (!app.isReady()) {
      pendingUrls.push(url)
      return
    }
    handleExternalUrl(url)
  })
}

/** 在 app ready 之后调用：注册为系统级 mistrelle:// 协议客户端（外部应用 open mistrelle://… 可唤起） */
export const registerDeepLink = (): void => {
  // ready 前 macOS 收到的唤起补收
  const pending = pendingUrls.splice(0)
  for (const url of pending) handleExternalUrl(url)

  if (!app.isDefaultProtocolClient(SCHEME)) {
    app.setAsDefaultProtocolClient(SCHEME)
  }

  // Windows/Linux 冷启动：首实例启动参数里可能携带 mistrelle:// URL
  //（second-instance 只覆盖二次唤起，冷启动无人消费会丢事件）
  const launchUrl = process.argv.find((arg) => arg.startsWith(`${SCHEME}://`))
  if (launchUrl) handleExternalUrl(launchUrl)

  // Windows / Linux 二次唤起：首实例经 second-instance 收到整条 argv，
  // 取首个 mistrelle:// 开头的参数交给 handleExternalUrl（不弹窗）
  app.on('second-instance', (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith(`${SCHEME}://`))
    if (url) handleExternalUrl(url)
  })
}
