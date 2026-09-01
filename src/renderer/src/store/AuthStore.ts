/**
 * 服务端账号 store：镜像主进程 AuthService 单例状态，多页面（AppSide / 账户设置页）共享。
 * 状态源在 main（登录/登出/凭证管理全在主进程），本 store 只负责拉取快照 + 订阅推送。
 */
import { defineStore } from 'pinia'
import { MessageUtil } from '@/utils/modal'

export const useAuthStore = defineStore('auth', () => {
  const status = ref<AuthStatus>('unknown')
  const user = ref<AuthUser | null>(null)
  const balance = ref<AuthBalance | null>(null)
  /** 公开档位列表（未登录态额度展示，无需登录） */
  const tiers = ref<AuthTierInfo[]>([])
  /** 登录 / 注册请求进行中（弹窗按钮 loading，防重复提交） */
  const submitting = ref(false)

  const lastRefreshedAt = ref(0)
  const REFRESH_STALE_MS = 60_000

  /**
   * 档位功能门控（统一消费点）：未登录 / unknown 视为免费档（两项受控功能均禁用）；
   * 已登录取服务端 features。thirdPartyRelay 暂不消费。
   */
  const FREE_FEATURES: AuthFeatures = {
    thirdPartyRelay: false,
    customFonts: false,
    extendedDesignStyles: false
  }
  const features = computed<AuthFeatures>(() =>
    status.value === 'signed-in' && user.value ? user.value.features : FREE_FEATURES
  )

  function apply(state: AuthState): void {
    const wasSignedIn = status.value === 'signed-in'
    status.value = state.status
    user.value = state.user
    balance.value = state.balance
    if (state.status === 'signed-in' && !wasSignedIn) lastRefreshedAt.value = Date.now()
    if (state.status !== 'signed-in') lastRefreshedAt.value = 0
  }

  async function loadTiers(): Promise<void> {
    try {
      tiers.value = await window.preload.auth.tiers()
    } catch (error) {
      tiers.value = []
      console.error('[auth] 获取公开档位失败', error)
    }
  }

  // store 单例，以下仅初始化一次：
  // 启动拉快照（弥补推送前的时间窗）+ 订阅主进程变更推送（登录/登出/刷新后自动同步）+ 拉公开档位
  window.preload.auth.getState().then(apply)
  window.preload.auth.onChanged(apply)
  loadTiers()

  /** 邮箱密码登录 */
  async function signIn(email: string, password: string): Promise<boolean> {
    submitting.value = true
    try {
      const res = await window.preload.auth.signIn({ email, password })
      if (!res.ok) MessageUtil.error(res.msg)
      return res.ok
    } finally {
      submitting.value = false
    }
  }

  /** 邮箱密码注册（注册即登录） */
  async function signUp(name: string, email: string, password: string): Promise<boolean> {
    submitting.value = true
    try {
      const res = await window.preload.auth.signUp({ name, email, password })
      if (!res.ok) MessageUtil.error(res.msg)
      return res.ok
    } finally {
      submitting.value = false
    }
  }

  /** 登出：服务端注销 + 本地凭证清除 */
  async function signOut(): Promise<boolean> {
    const res = await window.preload.auth.signOut()
    if (!res.ok) MessageUtil.error(res.msg)
    return res.ok
  }

  /** 修改用户名（成功后主进程刷新资料并广播，UI 经订阅自动同步） */
  async function updateName(name: string): Promise<boolean> {
    const res = await window.preload.auth.updateUser({ name })
    if (!res.ok) MessageUtil.error(res.msg)
    return res.ok
  }

  /** 修改密码（当前会话保持有效） */
  async function changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    const res = await window.preload.auth.changePassword({ currentPassword, newPassword })
    if (!res.ok) MessageUtil.error(res.msg)
    return res.ok
  }

  /** 手动刷新资料与余额（账户页「刷新 / 重试」按钮） */
  async function refresh(): Promise<void> {
    apply(await window.preload.auth.refresh())
    if (status.value !== 'guest') lastRefreshedAt.value = Date.now()
  }

  /** 距上次刷新超过 1 分钟才请求；游客跳过 */
  async function refreshIfStale(): Promise<void> {
    if (status.value === 'guest') return
    if (Date.now() - lastRefreshedAt.value < REFRESH_STALE_MS) return
    await refresh()
  }

  /** 验证激活码：结果由激活码弹窗内联展示（成功可激活内容 / 失败中文原因） */
  async function verifyCode(code: string): Promise<AuthCodeActionResult<AuthCodeVerifyResult>> {
    return window.preload.auth.verifyCode({ code })
  }

  /** 激活激活码：成功后主进程刷新并广播（user.features / tier / balance 自动同步） */
  async function redeemCode(code: string): Promise<AuthCodeActionResult<AuthCodeRedeemResult>> {
    return window.preload.auth.redeemCode({ code })
  }

  return {
    status,
    user,
    balance,
    tiers,
    submitting,
    features,
    loadTiers,
    signIn,
    signUp,
    signOut,
    updateName,
    changePassword,
    verifyCode,
    redeemCode,
    refresh,
    refreshIfStale
  }
})