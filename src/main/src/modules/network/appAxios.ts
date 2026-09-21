/**
 * 通用 axios 客户端（main 进程）：main 侧所有出站 HTTP 的统一出口。
 *
 * - `appAxios` 默认单例 / `createAppAxios(overrides)` 工厂（overrides 透传 axios.create，
 *   调用方显式配置——如 Auth 的 validateStatus 全放行、Relay 的 timeout 0——拦截器不覆盖）
 * - 请求拦截器每次请求读取网络设置（内存缓存 + 写时刷新：读零磁盘 IO，保存即生效）：
 *   超时 / 重定向 / UA 缺省注入 + 代理 + TLS 策略
 * - 代理实现：https 目标挂 HttpsProxyAgent / SocksProxyAgent（CONNECT 隧道，socks 一型两用），
 *   http 目标用 axios 原生 proxy（对 http 完整可用）——不用原生 proxy 打 https（不做 CONNECT、
 *   不支持 socks）
 * - TLS 策略（ignoreTlsCertError → rejectUnauthorized 取反）与读超时（agent socket 空闲超时）
 *   在无代理 / 代理两种形态下都生效；本地地址（127.0.0.1 / localhost / ::1）全部绕过
 *   （本地事件服务、dev server 不受代理与 TLS 策略影响）
 */
import https from 'node:https'
import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig
} from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'
import type { SettingNetwork } from '@common/types/networkSetting'
import { loadNetworkSetting } from './networkSetting'

/** agent 缓存：键 = 完整配置串，同配置复用同一实例防每请求新建泄漏 socket */
const agentCache = new Map<string, https.Agent>()

/** 解析请求最终目标 URL（拦截器阶段 url 与 baseURL 尚未合并，需手动拼接） */
function resolveTarget(config: InternalAxiosRequestConfig): URL | null {
  try {
    return new URL(config.url ?? '', config.baseURL || undefined)
  } catch {
    return null
  }
}

const isLocalTarget = (target: URL): boolean =>
  target.hostname === '127.0.0.1' || target.hostname === 'localhost' || target.hostname === '::1'

const proxyUrlOf = (setting: SettingNetwork): string | null => {
  if (setting.proxyMode !== 2 || !setting.proxyHost || !setting.proxyPort) return null
  const scheme = setting.proxyType === 'socket5' ? 'socks5' : 'http'
  const auth =
    setting.proxyUsername && setting.proxyPassword
      ? `${encodeURIComponent(setting.proxyUsername)}:${encodeURIComponent(setting.proxyPassword)}@`
      : ''
  return `${scheme}://${auth}${setting.proxyHost}:${setting.proxyPort}`
}

const cachedAgent = (key: string, build: () => https.Agent): https.Agent => {
  const cached = agentCache.get(key)
  if (cached) return cached
  const agent = build()
  agentCache.set(key, agent)
  return agent
}

/** https 目标的代理隧道 agent（http/https 代理均以 http 代理语义 CONNECT；socks5 走 socks） */
const httpsProxyAgent = (setting: SettingNetwork, proxyUrl: string): https.Agent => {
  const key = `${proxyUrl}|tls=${setting.ignoreTlsCertError}|rt=${setting.readTimeout}`
  const timeout = setting.readTimeout * 1000
  const rejectUnauthorized = !setting.ignoreTlsCertError
  if (setting.proxyType === 'socket5') {
    // ⚠️ SocksProxyAgent 构造器类型不透出 rejectUnauthorized，socks 通道 TLS 校验跟随 Node 默认
    return cachedAgent(key, () => new SocksProxyAgent(proxyUrl, { timeout }))
  }
  return cachedAgent(
    key,
    () => new HttpsProxyAgent(proxyUrl, { timeout, rejectUnauthorized })
  )
}

/** 无代理时的 https 基底 agent（TLS 策略 + 读超时） */
const plainHttpsAgent = (setting: SettingNetwork): https.Agent => {
  const key = `plain|tls=${setting.ignoreTlsCertError}|rt=${setting.readTimeout}`
  return cachedAgent(
    key,
    () =>
      new https.Agent({
        rejectUnauthorized: !setting.ignoreTlsCertError,
        timeout: setting.readTimeout * 1000
      })
  )
}

/** 请求拦截器：把最新网络设置注入本次请求（调用方显式传入的字段一律不覆盖） */
function applyNetworkSetting(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const setting = loadNetworkSetting()

  if (config.timeout === undefined) config.timeout = setting.connectTimeout * 1000
  if (config.maxRedirects === undefined) config.maxRedirects = setting.maxRedirects
  if (setting.userAgent && !config.headers?.has?.('User-Agent')) {
    config.headers?.set('User-Agent', setting.userAgent)
  }

  const target = resolveTarget(config)
  if (!target || isLocalTarget(target)) return config

  const proxyUrl = proxyUrlOf(setting)
  if (!proxyUrl) {
    config.httpsAgent = plainHttpsAgent(setting)
    return config
  }
  if (target.protocol === 'https:') {
    config.httpsAgent = httpsProxyAgent(setting, proxyUrl)
    return config
  }
  // http 目标：axios 原生 proxy 完整可用（绝对 URI 转发 + Proxy-Authorization）
  config.proxy = {
    host: setting.proxyHost,
    port: setting.proxyPort,
    protocol: 'http',
    ...(setting.proxyUsername && setting.proxyPassword
      ? { auth: { username: setting.proxyUsername, password: setting.proxyPassword } }
      : {})
  }
  return config
}

function attachInterceptor(instance: AxiosInstance): AxiosInstance {
  instance.interceptors.request.use(applyNetworkSetting)
  return instance
}

/** 创建挂了网络设置拦截器的 axios 实例（overrides 透传 axios.create，显式配置不被拦截器覆盖） */
export function createAppAxios(overrides: AxiosRequestConfig = {}): AxiosInstance {
  return attachInterceptor(axios.create(overrides))
}

/** 默认单例：无特殊 create 需求的调用方直接使用（ImageService / updater / quota 等） */
export const appAxios = createAppAxios()
