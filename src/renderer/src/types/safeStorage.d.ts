/**
 * window.preload.safeStorage 契约：OS 密钥链加解密（macOS Keychain / Windows DPAPI / Linux libsecret）。
 * 加密数据绑定本机，密文文件不可跨机拷贝使用。
 */
declare interface SafeStorageApi {
  /** 明文 → base64 密文；OS 加密不可用时返回 null（调用方降级明文） */
  encrypt: (plain: string) => Promise<string | null>
  /** base64 密文 → 明文；不可用或解密失败（含明文输入）返回 null */
  decrypt: (b64: string) => Promise<string | null>
}
