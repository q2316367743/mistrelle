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
  /** 公开增量包 SKU（无需登录） */
  pointsPacks: 'auth:pointsPacks',
  /** 修改用户名 / 修改密码（会话端点，走签名 Cookie） */
  updateUser: 'auth:updateUser',
  changePassword: 'auth:changePassword',
  /** 激活码验证（不执行激活） / 激活码兑换 */
  verifyCode: 'auth:verifyCode',
  redeemCode: 'auth:redeemCode',
  /** 积分流水分页（GET /api/user/transactions） */
  listTransactions: 'auth:listTransactions',
  /** 未过期增量包 lot（GET /api/user/pack-lots） */
  listPackLots: 'auth:listPackLots',
  /** 重新发送邮箱验证邮件（POST /auth/resend-verification；恒返回成功，同邮箱 60s 冷却） */
  resendVerification: 'auth:resendVerification',
  /** 在线设计风格列表（GET /api/user/design-styles） */
  listDesignStyles: 'auth:listDesignStyles',
  /** 在线设计风格详情（GET /api/user/design-styles/:id） */
  getDesignStyle: 'auth:getDesignStyle',
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
  /** 每日赠送剩余（当晚午夜清空） */
  pointsGift: number
  /** 管理端人工充值剩余（发放起 30 天有效） */
  pointsPaid: number
  /** 增量包剩余（未过期账本行之和） */
  pointsPack: number
  /** 当前档位每日赠送额度 */
  giftQuota: number
  /** 未过期剩余合计 */
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

/**
 * 登录 / 注册结果。除成功 / 普通失败外，还有「需要先验证邮箱」态：
 * - sign-in 被服务端拒 403 EMAIL_NOT_VERIFIED（未验证账号一律禁止登录建会话）；
 * - sign-up 因 requireEmailVerification 不建会话（2xx 但 token 为 null，含重复注册已存在邮箱场景）。
 * 渲染层命中该态后应关闭登录框并引导前往邮箱验证 / 重发验证邮件。
 */
export type AuthSignResult =
  | { ok: true }
  | { ok: false; msg: string; needEmailVerify?: boolean }

/** 公开档位信息（GET /api/tiers/，无需登录；账户卡片未登录态展示额度） */
export interface AuthTierInfo {
  code: string
  name: string
  category: string
  level: number
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

/** 公开增量包 SKU（GET /api/points-packs/） */
export interface AuthPackInfo {
  code: string
  name: string
  points: number
  price: number
  sort: number
}

export interface AuthPackCatalog {
  items: AuthPackInfo[]
}

export type AuthPackLotSource = 'activation' | 'admin' | 'legacy' | 'login'

export interface AuthPackLot {
  id: string
  granted: number
  remaining: number
  grantedAt: number
  expiresAt: number
  source: AuthPackLotSource
  packCode: string | null
  remark: string | null
}

export interface AuthPackLots {
  remaining: number
  items: AuthPackLot[]
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
  pack: { code: string; name: string } | null
  expiresAt: number | null
}

/** 激活结果（POST /api/user/activation-codes/redeem；时间戳为毫秒） */
export interface AuthCodeRedeemResult {
  type: string
  /** 会员档位 code；增量包为 null */
  tier: string | null
  /** 会员档位显示名；增量包为 null */
  tierName: string | null
  startedAt: number | null
  expiresAt: number | null
  grantedPoints: number
  /** 增量包到账积分；会员码为 null */
  points: number | null
  membership: { tier: string; expiresAt: number | null } | null
}

/** 激活码操作结果：失败时 msg 为可直接展示的中文原因，成功携带业务数据 */
export type AuthCodeActionResult<T> = { ok: true; data: T } | { ok: false; msg: string }

/** 带 data 的查询结果（流水等只读接口） */
export type AuthDataResult<T> = { ok: true; data: T } | { ok: false; msg: string }

export interface AuthPageParams {
  page: number
  pageSize: number
}

export interface AuthPaged<T> {
  total: number
  page: number
  pageSize: number
  items: T[]
}

/** 积分流水类型 */
export type AuthPointsTxType =
  | 'consume'
  | 'recharge'
  | 'refund'
  | 'admin_adjust'
  | 'gift_reset'
  | 'gift_grant'
  | 'tier_grant'
  | 'pack_grant'
  | 'pack_expire'
  | 'expire'

/** 在线设计风格列表项（卡片投影） */
export interface AuthDesignStyleItem {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  colorPalette: {
    primary: string
    secondary: string
    background: string
    surface: string
    text_primary: string
    text_secondary: string
  }
  typography: {
    heading: { font: string; weight: number; size: number; lineHeight: number }
    body: { font: string; weight: number; size: number; lineHeight: number }
    caption: { font: string; weight: number; size: number; lineHeight: number }
  }
  tokens: {
    spacing: { pageMargin: number; sectionGap: number; cardPadding: number; baseUnit: number }
    radius: { small: number; medium: number; large: number; pill: boolean }
    border: { width: number; style: string; color: string }
    shadow: {
      enabled: boolean
      offsetX: number
      offsetY: number
      blur: number
      color: string
    }
    motion: { duration: number; easing: string; scope: string }
  }
  whitespaceRatio: number
  sort: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

/** 在线设计风格完整详情 */
export interface AuthDesignStyleDetail extends AuthDesignStyleItem {
  visualPrompt: string
  negativePrompt: string
  layoutRules: string[]
  aliases: string[]
  signature: string
  preferredFormats: string[]
  suitableFor: string
  unsuitableFor: string
}

/** 积分流水项（GET /api/user/transactions；amount 正为收入、负为支出；createdAt 为 ISO） */
export interface AuthPointsTransaction {
  id: string
  userId: string
  type: AuthPointsTxType
  amount: number
  giftAfter: number
  totalAfter: number
  paidAfter: number
  packAfter: number
  bizType: string | null
  bizId: string | null
  sessionId: string | null
  requestId: string | null
  remark: string | null
  createdAt: string
}