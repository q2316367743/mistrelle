/**
 * safeStorage 桥（preload）：OS 密钥链加解密的 IPC 薄封装，实现位于 main（safeStorageIpc.ts）。
 */
import { ipcRenderer } from 'electron'
import { SafeStorageChannels } from './safeStorageChannels'

export const safeStorageApi = {
  /** 明文 → base64 密文；OS 加密不可用时返回 null（调用方降级明文） */
  encrypt: (plain: string): Promise<string | null> =>
    ipcRenderer.invoke(SafeStorageChannels.encrypt, plain),
  /** base64 密文 → 明文；不可用或解密失败（含明文输入）返回 null */
  decrypt: (b64: string): Promise<string | null> =>
    ipcRenderer.invoke(SafeStorageChannels.decrypt, b64)
}
