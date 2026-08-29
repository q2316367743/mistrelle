/**
 * crypto 模块（preload）：原 src-utools/src/CryptoApi.js 的 TS 移植。
 * 纯函数封装（node:crypto），无特权，留在 preload 侧。
 * 签名与原模块一致（返回 Promise），与 renderer 类型契约（types/crypto.d.ts）对齐。
 */
import crypto from 'node:crypto'

type CipherMode = 'CBC' | 'ECB'

const resolveAlgorithm = (key: string, mode: CipherMode): string => {
  const keyBuffer = Buffer.from(key)
  return mode === 'ECB' ? `aes-${keyBuffer.length * 8}-ecb` : `aes-${keyBuffer.length * 8}-cbc`
}

export const cryptoApi = {
  /** MD5 哈希：32 位小写十六进制 */
  md5(data: string): string {
    return crypto.createHash('md5').update(Buffer.from(data)).digest('hex')
  },

  /** AES 加密（CBC 模式 iv 必填），返回 Base64 密文 */
  async aesEncrypt(data: string, key: string, iv?: string, mode: CipherMode = 'CBC'): Promise<string> {
    const cipher = crypto.createCipheriv(
      resolveAlgorithm(key, mode),
      Buffer.from(key),
      mode === 'ECB' ? '' : Buffer.from(iv || '')
    )
    let encrypted = cipher.update(data, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    return encrypted
  },

  /** AES 解密（CBC 模式 iv 必填） */
  async aesDecrypt(data: string, key: string, iv?: string, mode: CipherMode = 'CBC'): Promise<string> {
    const decipher = crypto.createDecipheriv(
      resolveAlgorithm(key, mode),
      Buffer.from(key),
      mode === 'ECB' ? '' : Buffer.from(iv || '')
    )
    let decrypted = decipher.update(data, 'base64', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  },

  /** AES 解密（IV 为 Base64 编码的原始字节，适用于服务端随机生成的二进制 IV） */
  async aesDecryptB64Iv(cipher: string, key: string, ivB64: string, mode: CipherMode = 'CBC'): Promise<string> {
    const decipher = crypto.createDecipheriv(
      resolveAlgorithm(key, mode),
      Buffer.from(key),
      mode === 'ECB' ? '' : Buffer.from(ivB64, 'base64')
    )
    let decrypted = decipher.update(cipher, 'base64', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  },

  /** DES-CBC 加密（key 8 字节，iv 8 字节） */
  async desEncrypt(data: string, key: string, iv?: string): Promise<string> {
    const cipher = crypto.createCipheriv('des-cbc', Buffer.from(key), Buffer.from(iv || ''))
    let encrypted = cipher.update(data, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    return encrypted
  },

  /** DES-CBC 解密（key 8 字节，iv 8 字节） */
  async desDecrypt(data: string, key: string, iv?: string): Promise<string> {
    const decipher = crypto.createDecipheriv('des-cbc', Buffer.from(key), Buffer.from(iv || ''))
    let decrypted = decipher.update(data, 'base64', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }
}
