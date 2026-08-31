/**
 * window.preload.auth 契约：服务端账号桥。
 * 与 main 的 AuthService（单例共享状态）/ authIpc.ts 对应；渲染层只调用类型化方法并订阅状态推送。
 */

/** 登录状态：unknown=尚未确认（启动中 / 服务端不可达），guest=未登录，signed-in=已登录 */
declare type AuthStatus = 'unknown' | 'guest' | 'signed-in'

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
  features: Record<string, boolean>
  dailyGiftPoints: number
}

/** 积分余额（GET /api/user/balance 归一后的域模型） */
declare interface AuthBalance {
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

declare interface AuthNameParams {
  name: string
}

declare interface AuthChangePasswordParams {
  currentPassword: string
  newPassword: string
}

declare interface AuthApi {
  getState(): Promise<AuthState>
  /** 公开档位列表（无需登录） */
  tiers(): Promise<AuthTierInfo[]>
  signIn(params: AuthSignInParams): Promise<AuthActionResult>
  signUp(params: AuthSignUpParams): Promise<AuthActionResult>
  signOut(): Promise<AuthActionResult>
  /** 修改用户名（成功后主进程刷新资料并广播） */
  updateUser(params: AuthNameParams): Promise<AuthActionResult>
  /** 修改密码（当前会话保持有效） */
  changePassword(params: AuthChangePasswordParams): Promise<AuthActionResult>
  refresh(): Promise<AuthState>
  /** 订阅主进程状态变更推送；返回取消订阅函数 */
  onChanged(callback: (state: AuthState) => void): () => void
}