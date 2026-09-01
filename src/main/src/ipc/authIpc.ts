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
  type AuthNameParams,
  type AuthSignInParams,
  type AuthSignUpParams,
  type AuthState,
  type AuthTierInfo
} from '~/ipc/authChannels'
import {
  changePassword,
  current,
  refresh,
  redeemActivationCode,
  signIn,
  signOut,
  signUp,
  tiers,
  updateUser,
  verifyActivationCode
} from '$/auth/AuthService'

export function registerAuthIpc(): void {
  ipcMain.handle(AuthChannels.getState, (): AuthState => current())
  ipcMain.handle(AuthChannels.tiers, (): Promise<AuthTierInfo[]> => tiers())
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
}
