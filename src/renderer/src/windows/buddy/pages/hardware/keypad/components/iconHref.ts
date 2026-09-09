/**
 * 应用图标 URL：经本地事件服务的图标面（/icon/app）取应用图标 PNG，
 * main 现提取落缓存，404/加载失败由调用方回退占位。
 */
import { EVENT_SERVER_ORIGIN } from '@common/server/eventServer'

export function appIconHref(path: string): string {
  return `${EVENT_SERVER_ORIGIN}/icon/app?path=${encodeURIComponent(path)}`
}

/** 应用展示名：取路径末段并去掉常见应用包后缀（列表外自定义路径的兜底显示） */
export function appDisplayName(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? path
  return base.replace(/\.(app|lnk|exe)$/i, '')
}
