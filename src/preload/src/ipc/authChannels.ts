/**
 * 服务端账号域通道常量与类型（preload 桥与 main handler 共用）。
 *
 * 设计约定（见 docs/auth/01-server-auth.md）：
 * - 客户端与共享状态都在 main（auth/AuthService.ts 单例），preload 只透传并订阅状态推送。
 * - 登录/注册/登出等变更类操作返回 AuthActionResult（ok/msg），不抛跨进程的包装异常。
 * - 独立于 channels.ts（其已贴 500 行红线），本文件只承载 auth 域。
 */
export const AuthChannels = {
  getState: 'auth:getState',
  signIn: 'auth:signIn',
  signUp: 'auth:signUp',
  signOut: 'auth:signOut',
  refresh: 'auth:refresh',
  /** 公开档位列表（无需登录） */
  tiers: 'auth:tiers',
  /** 修改用户名 / 修改密码（会话端点，走签名 Cookie） */
  updateUser: 'auth:updateUser',
  changePassword: 'auth:changePassword',
  /** 激活码验证（不执行激活） / 激活码兑换 */
  verifyCode: 'auth:verifyCode',
  redeemCode: 'auth:redeemCode',
  /** 主进程 → 渲染层状态变更推送（登录/登出/刷新后广播） */
  changed: 'auth:changed'
} as const

/** 登录状态：unknown=尚未确认（启动中 / 服务端不可达），guest=未登录，signed-in=已登录 */
export type AuthStatus = 'unknown' | 'guest' | 'signed-in'

/** 档位能力键：thirdPartyRelay 暂不消费（模型侧不变，仅透传） */
export type AuthFeatureKey = 'thirdPartyRelay' | 'customFonts' | 'extendedDesignStyles'

/** 档位能力契约（feature 名 → 是否开放） */
export type AuthFeatures = Record<AuthFeatureKey, boolean>

/** 免费档 / 未登录基线能力 */
export const AUTH_FREE_FEATURES: AuthFeatures = {
  thirdPartyRelay: false,
  customFonts: false,
  extendedDesignStyles: false
}

/** 归一服务端 features（unknown → 三键布尔，缺省 false） */
export function normalizeAuthFeatures(raw: unknown): AuthFeatures {
  if (!raw || typeof raw !== 'object') return { ...AUTH_FREE_FEATURES }
  const record = raw as Record<string, unknown>
  return {
    thirdPartyRelay: record.thirdPartyRelay === true,
    customFonts: record.customFonts === true,
    extendedDesignStyles: record.extendedDesignStyles === true
  }
}

/** 当前用户资料（GET /api/user/me 归一后的域模型） */
export interface AuthUser {
  id: string
  name: string
  email: string
  isAdmin: boolean
  /** 会员档位代码（如 experience/lite/…）；无会员为 null */
  tier: string | null
  membership: { tier: string; expiresAt: string | null } | null
  /** 档位能力契约（feature 名 → 是否开放） */
  features: AuthFeatures
  dailyGiftPoints: number
}

/** 积分余额（GET /api/user/balance 归一后的域模型） */
export interface AuthBalance {
  /** 每日赠送积分（当日有效，次日重置） */
  pointsGift: number
  /** 总积分（套餐月度发放，永久保留） */
  pointsTotal: number
  /** 充值积分 */
  pointsPaid: number
  /** 当前档位每日赠送额度 */
  giftQuota: number
  giftResetDate: string
  /** 三池合计 */
  total: number
}

export interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  balance: AuthBalance | null
}

export interface AuthSignInParams {
  email: string
  password: string
}

export interface AuthSignUpParams {
  name: string
  email: string
  password: string
}

/** 变更类操作结果：失败时 msg 为可直接展示的中文原因 */
export type AuthActionResult = { ok: true } | { ok: false; msg: string }

/** 公开档位信息（GET /api/tiers/，无需登录；账户卡片未登录态展示额度） */
export interface AuthTierInfo {
  code: string
  name: string
  category: string
  level: number
  basePoints: number
  dailyGiftPoints: number
  /** 价格（元/月）；免费档为 0 */
  price: number
  /** 使用第三方中转商（配置自定义 provider） */
  thirdPartyRelay: boolean
  /** 自定义第三方字体（规划中） */
  customFonts: boolean
  /** 更多设计风格（默认仅自带） */
  extendedDesignStyles: boolean
}

export interface AuthNameParams {
  name: string
}

export interface AuthChangePasswordParams {
  currentPassword: string
  newPassword: string
}

export interface AuthCodeParams {
  code: string
}

/**
 * 激活码验证结果（POST /api/user/activation-codes/verify，不执行激活）。
 * 展示按 tier / points 是否非空判别：tier 非空=会员码（附档位与时长），
 * points 非空=积分包；不依赖 type 字符串值。
 */
export interface AuthCodeVerifyResult {
  type: string
  tier: { code: string; name: string; level: number; months: number } | null
  points: number | null
  expiresAt: number | null
}

/** 激活结果（POST /api/user/activation-codes/redeem；时间戳为毫秒） */
export interface AuthCodeRedeemResult {
  type: string
  tier: string
  tierName: string
  startedAt: number
  expiresAt: number
  grantedPoints: number
  membership: { tier: string; expiresAt: number | null } | null
}

/** 激活码操作结果：失败时 msg 为可直接展示的中文原因，成功携带业务数据 */
export type AuthCodeActionResult<T> = { ok: true; data: T } | { ok: false; msg: string }