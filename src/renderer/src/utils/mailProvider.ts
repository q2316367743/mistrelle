/**
 * 邮箱提供商推断：从注册邮箱域名映射到该邮箱的网页登录地址（收件箱），
 * 供「邮箱未验证」引导弹框的「前往邮箱验证」按钮使用。
 *
 * 仅枚举知名域名（精确匹配邮箱域名后缀），未命中时兜底 `https://mail.<domain>`；
 * 域名不可识别或地址非法时返回 null（调用方应隐藏该入口）。
 */

export interface MailProvider {
  /** 提供商展示名（如「QQ 邮箱」） */
  name: string
  /** 收件箱 / 登录页地址 */
  url: string
}

const KNOWN_DOMAINS: Record<string, { name: string; url: string }> = {
  'qq.com': { name: 'QQ 邮箱', url: 'https://mail.qq.com' },
  'foxmail.com': { name: 'Foxmail', url: 'https://mail.qq.com' },
  '163.com': { name: '网易 163 邮箱', url: 'https://mail.163.com' },
  '126.com': { name: '网易 126 邮箱', url: 'https://mail.126.com' },
  'yeah.net': { name: '网易 Yeah 邮箱', url: 'https://www.yeah.net' },
  'gmail.com': { name: 'Gmail', url: 'https://mail.google.com' },
  'googlemail.com': { name: 'Gmail', url: 'https://mail.google.com' },
  'outlook.com': { name: 'Outlook', url: 'https://outlook.live.com/mail/' },
  'hotmail.com': { name: 'Outlook', url: 'https://outlook.live.com/mail/' },
  'live.com': { name: 'Outlook', url: 'https://outlook.live.com/mail/' },
  'msn.com': { name: 'Outlook', url: 'https://outlook.live.com/mail/' },
  'icloud.com': { name: 'iCloud 邮件', url: 'https://www.icloud.com/mail/' },
  'me.com': { name: 'iCloud 邮件', url: 'https://www.icloud.com/mail/' },
  'aliyun.com': { name: '阿里邮箱', url: 'https://mail.aliyun.com' },
  'dingtalk.com': { name: '钉钉邮箱', url: 'https://mail.dingtalk.com' },
  'sina.com': { name: '新浪邮箱', url: 'https://mail.sina.com.cn' },
  'sina.cn': { name: '新浪邮箱', url: 'https://mail.sina.com.cn' },
  'sohu.com': { name: '搜狐邮箱', url: 'https://mail.sohu.com' },
  '139.com': { name: '139 邮箱', url: 'https://mail.10086.cn' },
  '189.cn': { name: '189 邮箱', url: 'https://webmail30.189.cn' },
  'hey.com': { name: 'HEY', url: 'https://www.hey.com' },
  'proton.me': { name: 'Proton Mail', url: 'https://account.proton.me/mail' },
  'protonmail.com': { name: 'Proton Mail', url: 'https://account.proton.me/mail' },
  'fastmail.com': { name: 'Fastmail', url: 'https://app.fastmail.com' },
  'zoho.com': { name: 'Zoho Mail', url: 'https://mail.zoho.com' },
  '163.net': { name: '163.net 邮箱', url: 'https://www.163.net' },
  'tom.com': { name: 'Tom 邮箱', url: 'https://mail.tom.com' },
  '21cn.com': { name: '21CN 邮箱', url: 'https://mail.21cn.com' }
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * 从邮箱地址推断网页收件箱地址；未知域名返回「mail.<domain>」兜底，地址非法返回 null。
 * 私有 IP / 内网域名兜底也无意义，但不属本工具职责，交由调用方决定是否展示。
 */
export function mailProviderOf(email: string): MailProvider | null {
  const value = email?.trim()
  if (!value || !isEmail(value)) return null
  const domain = value.split('@')[1].toLowerCase()
  const known = KNOWN_DOMAINS[domain]
  if (known) return known
  return { name: `${domain.split('.')[0]} 邮箱`, url: `https://mail.${domain}` }
}
