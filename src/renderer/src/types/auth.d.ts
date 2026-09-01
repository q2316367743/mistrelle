/**
 * window.preload.auth 契约：服务端账号桥。
 * 与 main 的 AuthService（单例共享状态）/ authIpc.ts 对应；渲染层只调用类型化方法并订阅状态推送。
 */

/** 登录状态：unknown=尚未确认（启动中 / 服务端不可达），guest=未登录，signed-in=已登录 */
declare type AuthStatus = 'unknown' | 'guest' | 'signed-in'

/** 档位能力键：thirdPartyRelay 暂不消费（模型侧不变，仅透传） */
declare type AuthFeatureKey = 'thirdPartyRelay' | 'customFonts' | 'extendedDesignStyles'

/** 档位能力契约（feature 名 → 是否开放） */
declare type AuthFeatures = Record<AuthFeatureKey, boolean>

/** 当前用户资料（GET /api/user/me 归一后的域模型） */
declare interface AuthUser {
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
declare interface AuthBalance {
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

declare interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  balance: AuthBalance | null
}

declare interface AuthSignInParams {
  email: string
  password: string
}

declare interface AuthSignUpParams {
  name: string
  email: string
  password: string
}

/** 变更类操作结果：失败时 msg 为可直接展示的中文原因 */
declare type AuthActionResult = { ok: true } | { ok: false; msg: string }

/** 公开档位信息（无需登录；账户卡片未登录态展示额度） */
declare interface AuthTierInfo {
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

declare interface AuthPackInfo {
  code: string
  name: string
  points: number
  price: number
  sort: number
}

declare interface AuthPackCatalog {
  items: AuthPackInfo[]
}

declare type AuthPackLotSource = 'activation' | 'admin' | 'legacy' | 'login'

declare interface AuthPackLot {
  id: string
  granted: number
  remaining: number
  grantedAt: number
  expiresAt: number
  source: AuthPackLotSource
  packCode: string | null
  remark: string | null
}

declare interface AuthPackLots {
  remaining: number
  items: AuthPackLot[]
}

declare interface AuthNameParams {
  name: string
}

declare interface AuthChangePasswordParams {
  currentPassword: string
  newPassword: string
}

declare interface AuthCodeParams {
  code: string
}

/**
 * 激活码验证结果（不执行激活）。展示按 tier / points 是否非空判别：
 * tier 非空=会员码（附档位与时长），points 非空=积分包；不依赖 type 字符串值。
 */
declare interface AuthCodeVerifyResult {
  type: string
  tier: { code: string; name: string; level: number; months: number } | null
  points: number | null
  pack: { code: string; name: string } | null
  expiresAt: number | null
}

/** 激活结果（时间戳为毫秒） */
declare interface AuthCodeRedeemResult {
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
declare type AuthCodeActionResult<T> = { ok: true; data: T } | { ok: false; msg: string }

declare type AuthDataResult<T> = { ok: true; data: T } | { ok: false; msg: string }

declare interface AuthPageParams {
  page: number
  pageSize: number
}

declare interface AuthPaged<T> {
  total: number
  page: number
  pageSize: number
  items: T[]
}

declare type AuthPointsTxType =
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

declare interface AuthPointsTransaction {
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

declare interface AuthApi {
  getState(): Promise<AuthState>
  /** 公开档位列表（无需登录） */
  tiers(): Promise<AuthTierInfo[]>
  /** 公开增量包 SKU（无需登录） */
  pointsPacks(): Promise<AuthPackCatalog>
  signIn(params: AuthSignInParams): Promise<AuthActionResult>
  signUp(params: AuthSignUpParams): Promise<AuthActionResult>
  signOut(): Promise<AuthActionResult>
  /** 修改用户名（成功后主进程刷新资料并广播） */
  updateUser(params: AuthNameParams): Promise<AuthActionResult>
  /** 修改密码（当前会话保持有效） */
  changePassword(params: AuthChangePasswordParams): Promise<AuthActionResult>
  /** 验证激活码：只返回可激活内容（会员档位或积分包），不执行激活 */
  verifyCode(params: AuthCodeParams): Promise<AuthCodeActionResult<AuthCodeVerifyResult>>
  /** 激活激活码：成功后主进程刷新资料并广播（UI 自动同步档位与余额） */
  redeemCode(params: AuthCodeParams): Promise<AuthCodeActionResult<AuthCodeRedeemResult>>
  refresh(): Promise<AuthState>
  /** 积分流水分页 */
  listTransactions(params: AuthPageParams): Promise<AuthDataResult<AuthPaged<AuthPointsTransaction>>>
  /** 未过期增量包 lot */
  listPackLots(): Promise<AuthDataResult<AuthPackLots>>
  /** 订阅主进程状态变更推送；返回取消订阅函数 */
  onChanged(callback: (state: AuthState) => void): () => void
}