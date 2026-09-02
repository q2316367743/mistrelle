/**
 * 服务端账号 IPC handler（main 进程）：auth 域透传 AuthService。
 * 所有业务逻辑在 AuthService（单例共享状态），此处只做通道透传。
 */
import { ipcMain } from 'electron'
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
  type AuthTierInfo,
  type AuthDesignStyleDetail,
  type AuthDesignStyleItem,
  type AuthPackCatalog,
  type AuthPackLots
} from '~/ipc/authChannels'
import {
  changePassword,
  current,
  listTransactions,
  listPackLots,
  pointsPacks,
  refresh,
  redeemActivationCode,
  signIn,
  signOut,
  signUp,
  tiers,
  updateUser,
  verifyActivationCode
} from '$/auth/AuthService'
import { getDesignStyle, listDesignStyles } from '$/auth/DesignStyleRemote'

export function registerAuthIpc(): void {
  ipcMain.handle(AuthChannels.getState, (): AuthState => current())
  ipcMain.handle(AuthChannels.tiers, (): Promise<AuthTierInfo[]> => tiers())
  ipcMain.handle(AuthChannels.pointsPacks, (): Promise<AuthPackCatalog> => pointsPacks())
  ipcMain.handle(
    AuthChannels.signIn,
    (_event, params: AuthSignInParams): Promise<AuthActionResult> => signIn(params)
  )
  ipcMain.handle(
    AuthChannels.signUp,
    (_event, params: AuthSignUpParams): Promise<AuthActionResult> => signUp(params)
  )
  ipcMain.handle(AuthChannels.signOut, (): Promise<AuthActionResult> => signOut())
  ipcMain.handle(
    AuthChannels.updateUser,
    (_event, params: AuthNameParams): Promise<AuthActionResult> => updateUser(params.name)
  )
  ipcMain.handle(
    AuthChannels.changePassword,
    (_event, params: AuthChangePasswordParams): Promise<AuthActionResult> =>
      changePassword(params.currentPassword, params.newPassword)
  )
  ipcMain.handle(AuthChannels.refresh, (): Promise<AuthState> => refresh())
  ipcMain.handle(
    AuthChannels.verifyCode,
    (_event, params: AuthCodeParams): Promise<AuthCodeActionResult<AuthCodeVerifyResult>> =>
      verifyActivationCode(params)
  )
  ipcMain.handle(
    AuthChannels.redeemCode,
    (_event, params: AuthCodeParams): Promise<AuthCodeActionResult<AuthCodeRedeemResult>> =>
      redeemActivationCode(params)
  )
  ipcMain.handle(
    AuthChannels.listTransactions,
    (
      _event,
      params: AuthPageParams
    ): Promise<AuthDataResult<AuthPaged<AuthPointsTransaction>>> => listTransactions(params)
  )
  ipcMain.handle(AuthChannels.listPackLots, (): Promise<AuthDataResult<AuthPackLots>> => listPackLots())
  ipcMain.handle(
    AuthChannels.listDesignStyles,
    (): Promise<AuthDataResult<AuthDesignStyleItem[]>> => listDesignStyles()
  )
  ipcMain.handle(
    AuthChannels.getDesignStyle,
    (_event, id: string): Promise<AuthDataResult<AuthDesignStyleDetail>> => getDesignStyle(id)
  )
}
