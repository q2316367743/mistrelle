/**
 * 网络设置契约（main networkSetting / 渲染层 SettingNetworkStore 三方共用）。
 * main 侧通用 axios 客户端（appAxios）每次请求读取最新设置，实现代理 / 超时 / TLS 统一注入。
 */

export interface SettingNetwork {
  // User-Agent（空 = 不注入，由各请求自身决定）
  userAgent: string
  // 连接超时时间（秒）
  connectTimeout: number
  // 读取超时时间（秒，生效为 agent socket 空闲超时）
  readTimeout: number
  // 忽略 TLS 证书错误（生效为 httpsAgent.rejectUnauthorized 取反）
  ignoreTlsCertError: boolean
  // 最大重定向次数
  maxRedirects: number
  /**
   * 代理模式
   * - 1：无代理
   * - 2：自定义代理
   */
  proxyMode: 1 | 2
  // 代理类型
  proxyType: 'http' | 'https' | 'socket5'
  // 代理主机
  proxyHost: string
  // 代理端口
  proxyPort: number
  // 代理用户名
  proxyUsername: string
  // 代理密码
  proxyPassword: string
}

export function buildSettingNetwork(): SettingNetwork {
  return {
    userAgent: '',
    connectTimeout: 10,
    readTimeout: 30,
    ignoreTlsCertError: true,
    maxRedirects: 5,
    proxyMode: 1,
    proxyType: 'http',
    proxyHost: '',
    proxyPort: 0,
    proxyUsername: '',
    proxyPassword: ''
  }
}

/**
 * 归一化：与默认值合并，修掉旧版本文件缺字段（undefined）与手改脏值。
 * 枚举字段非法时回退默认，数值字段非正数时回退默认。
 */
export function normalizeNetworkSetting(raw: unknown): SettingNetwork {
  const base = buildSettingNetwork()
  if (typeof raw !== 'object' || raw === null) return base
  const source = raw as Record<string, unknown>
  const num = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
  const proxyType = source.proxyType
  const proxyMode = source.proxyMode
  return {
    userAgent: typeof source.userAgent === 'string' ? source.userAgent : base.userAgent,
    connectTimeout: num(source.connectTimeout, base.connectTimeout),
    readTimeout: num(source.readTimeout, base.readTimeout),
    ignoreTlsCertError:
      typeof source.ignoreTlsCertError === 'boolean'
        ? source.ignoreTlsCertError
        : base.ignoreTlsCertError,
    maxRedirects: num(source.maxRedirects, base.maxRedirects),
    proxyMode: proxyMode === 2 ? 2 : 1,
    proxyType:
      proxyType === 'http' || proxyType === 'https' || proxyType === 'socket5'
        ? proxyType
        : base.proxyType,
    proxyHost: typeof source.proxyHost === 'string' ? source.proxyHost : base.proxyHost,
    proxyPort: num(source.proxyPort, base.proxyPort),
    proxyUsername:
      typeof source.proxyUsername === 'string' ? source.proxyUsername : base.proxyUsername,
    proxyPassword:
      typeof source.proxyPassword === 'string' ? source.proxyPassword : base.proxyPassword
  }
}
