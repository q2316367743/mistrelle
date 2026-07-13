export interface SettingNetwork {
  // User-Agent
  userAgent: string
  // 连接超时时间
  connectTimeout: number
  // 读取超时时间
  readTimeout: number
  // 忽略 TLS 证书错误
  ignoreTlsCertError: boolean
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
    proxyMode: 1,
    proxyType: 'http',
    proxyHost: '',
    proxyPort: 0,
    proxyUsername: '',
    proxyPassword: ''
  }
}
