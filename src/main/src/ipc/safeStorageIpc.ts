/**
 * safeStorage IPC handler（main 进程）：OS 密钥链加密（macOS Keychain / Windows DPAPI / Linux libsecret）。
 * 加密数据绑定本机；不可用（如 Linux 无 keyring）或解密失败时返回 null，由调用方决定降级策略。
 */
import { ipcMain, safeStorage } from 'electron'
import { SafeStorageChannels } from '~/ipc/channels'

export function registerSafeStorageIpc(): void {
  ipcMain.handle(SafeStorageChannels.encrypt, (_event, plain: string): string | null => {
    if (!safeStorage.isEncryptionAvailable()) return null
    return safeStorage.encryptString(plain).toString('base64')
  })

  ipcMain.handle(SafeStorageChannels.decrypt, (_event, b64: string): string | null => {
    if (!safeStorage.isEncryptionAvailable()) return null
    try {
      return safeStorage.decryptString(Buffer.from(b64, 'base64'))
    } catch {
      return null
    }
  })
}
