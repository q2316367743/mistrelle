/**
 * 服务端账号桥（preload）：auth 域的 IPC 薄封装 + 状态订阅。
 * 客户端与共享状态在 main（AuthService 单例），渲染层只调用类型化方法并订阅变更推送。
 */
import { ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import {
  AuthChannels,
  type AuthActionResult,
  type AuthChangePasswordParams,
  type AuthCodeActionResult,
  type AuthCodeParams,
  type AuthCodeRedeemResult,
  type AuthCodeVerifyResult,
  type AuthDataResult,
  type AuthNameParams,
  type AuthPageParams,
  type AuthPaged,
  type AuthPointsTransaction,
  type AuthSignInParams,
  type AuthSignUpParams,
  type AuthState,
  type AuthSignResult,
  type AuthTierInfo,
  type AuthDesignStyleDetail,
  type AuthDesignStyleItem,
  type AuthPackCatalog,
  type AuthPackLots
} from './authChannels'

export const authApi = {
  /** 读取当前登录状态快照（应用启动 / 页面挂载时拉取） */
  getState: (): Promise<AuthState> => ipcRenderer.invoke(AuthChannels.getState),
  /** 公开档位列表（无需登录，账户卡片未登录态展示额度） */
  tiers: (): Promise<AuthTierInfo[]> => ipcRenderer.invoke(AuthChannels.tiers),
  /** 公开增量包 SKU（无需登录） */
  pointsPacks: (): Promise<AuthPackCatalog> => ipcRenderer.invoke(AuthChannels.pointsPacks),
  /** 邮箱密码登录；成功即签发长期 API Key 并双存凭证 */
  signIn: (params: AuthSignInParams): Promise<AuthSignResult> =>
    ipcRenderer.invoke(AuthChannels.signIn, params),
  /** 邮箱密码注册（注册即登录），链路同 signIn；未验证账号不建会话（needEmailVerify） */
  signUp: (params: AuthSignUpParams): Promise<AuthSignResult> =>
    ipcRenderer.invoke(AuthChannels.signUp, params),
  /** 登出：服务端注销会话/删 key（尽力而为）+ 本地凭证清除 */
  signOut: (): Promise<AuthActionResult> => ipcRenderer.invoke(AuthChannels.signOut),
  /** 修改用户名（成功后主进程刷新资料并广播） */
  updateUser: (params: AuthNameParams): Promise<AuthActionResult> =>
    ipcRenderer.invoke(AuthChannels.updateUser, params),
  /** 修改密码（当前会话保持有效） */
  changePassword: (params: AuthChangePasswordParams): Promise<AuthActionResult> =>
    ipcRenderer.invoke(AuthChannels.changePassword, params),
  /** 验证激活码：只返回可激活内容（会员档位或积分包），不执行激活 */
  verifyCode: (params: AuthCodeParams): Promise<AuthCodeActionResult<AuthCodeVerifyResult>> =>
    ipcRenderer.invoke(AuthChannels.verifyCode, params),
  /** 激活激活码：成功后主进程刷新资料并广播（UI 自动同步档位与余额） */
  redeemCode: (params: AuthCodeParams): Promise<AuthCodeActionResult<AuthCodeRedeemResult>> =>
    ipcRenderer.invoke(AuthChannels.redeemCode, params),
  /** 重新发送邮箱验证邮件（POST /auth/resend-verification；恒成功，60s 冷却） */
  resendVerification: (email: string): Promise<AuthActionResult> =>
    ipcRenderer.invoke(AuthChannels.resendVerification, email),
  /** 手动刷新资料与余额（账户页「刷新」按钮） */
  refresh: (): Promise<AuthState> => ipcRenderer.invoke(AuthChannels.refresh),
  /** 积分流水分页 */
  listTransactions: (
    params: AuthPageParams
  ): Promise<AuthDataResult<AuthPaged<AuthPointsTransaction>>> =>
    ipcRenderer.invoke(AuthChannels.listTransactions, params),
  /** 未过期增量包 lot */
  listPackLots: (): Promise<AuthDataResult<AuthPackLots>> =>
    ipcRenderer.invoke(AuthChannels.listPackLots),
  /** 在线设计风格列表（需会员更多设计风格能力） */
  listDesignStyles: (): Promise<AuthDataResult<AuthDesignStyleItem[]>> =>
    ipcRenderer.invoke(AuthChannels.listDesignStyles),
  /** 在线设计风格详情 */
  getDesignStyle: (id: string): Promise<AuthDataResult<AuthDesignStyleDetail>> =>
    ipcRenderer.invoke(AuthChannels.getDesignStyle, id),
  /** 订阅主进程状态变更推送；返回取消订阅函数 */
  onChanged: (callback: (state: AuthState) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, state: AuthState): void => callback(state)
    ipcRenderer.on(AuthChannels.changed, listener)
    return () => {
      ipcRenderer.removeListener(AuthChannels.changed, listener)
    }
  }
}