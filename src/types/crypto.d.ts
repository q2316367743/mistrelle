declare interface CryptoApi {
  md5: (text: string) => string
  aesEncrypt: (data: string, key: string, iv?: string, mode?: 'CBC' | 'ECB') => Promise<string>
  // AES 解密。
  aesDecrypt: (data: string, key: string, iv?: string, mode?: 'CBC' | 'ECB') => Promise<string>
  // AES 解密，IV 为 Base64 编码的原始字节。适用于服务端随机生成的二进制 IV。
  aesDecryptB64Iv: (cipher: string, key: string, ivB64: string, mode?: string) => Promise<string>
  // DES-CBC 加密。
  desEncrypt: (data: string, key: string, iv?: string) => Promise<string>
  // DES-CBC 解密。
  desDecrypt: (data: string, key: string, iv?: string) => Promise<string>
}
