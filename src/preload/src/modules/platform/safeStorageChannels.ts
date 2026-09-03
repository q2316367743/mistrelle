/**
 * safeStorage 域 IPC 契约：OS 密钥链加解密通道。
 * preload 桥与 main handler 共用，保持两侧契约一致。
 */
// ── safeStorage ────────────────────────────────────────────
export const SafeStorageChannels = {
  encrypt: 'safeStorage:encrypt',
  decrypt: 'safeStorage:decrypt'
} as const
