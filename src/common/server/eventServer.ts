/**
 * 本地事件服务（main 进程 express 监听 / preload pathToHref / 外部插件各自引用的同一事实源）。
 * 资源面：GET {ORIGIN}/file/<encodeURIComponent(绝对路径)>；事件面：{ORIGIN}/<模块>/<功能>?<query>。
 * 详见 docs/server/01-event-server.md。
 */
export const EVENT_SERVER_ORIGIN = 'http://127.0.0.1:47743'
