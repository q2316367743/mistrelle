const crypto = require('node:crypto')

module.exports = {
  /**
   * MD5 哈希
   * @param {string} data - 待哈希的字符串
   * @returns {string} 32位小写十六进制哈希值
   */
  md5(data) {
    return crypto.createHash('md5').update(Buffer.from(data)).digest('hex')
  },

  /**
   * AES 加密
   * @param {string} data - 待加密的明文字符串
   * @param {string} key - 加密密钥（16/24/32字节对应AES-128/192/256）
   * @param {string} [iv] - 初始化向量（CBC模式必填）
   * @param {'CBC'|'ECB'} [mode='CBC'] - 加密模式
   * @returns {Promise<string>} Base64编码的密文
   */
  aesEncrypt: async (data, key, iv, mode = 'CBC') => {
    const keyBuffer = Buffer.from(key)
    const algorithm = mode === 'ECB'
      ? `aes-${keyBuffer.length * 8}-ecb`
      : `aes-${keyBuffer.length * 8}-cbc`

    const cipher = crypto.createCipheriv(
      algorithm,
      keyBuffer,
      mode === 'ECB' ? '' : Buffer.from(iv || '')
    )

    let encrypted = cipher.update(data, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    return encrypted
  },

  /**
   * AES 解密
   * @param {string} data - Base64编码的密文
   * @param {string} key - 解密密钥（16/24/32字节对应AES-128/192/256）
   * @param {string} [iv] - 初始化向量（CBC模式必填）
   * @param {'CBC'|'ECB'} [mode='CBC'] - 解密模式
   * @returns {Promise<string>} 解密后的明文
   */
  aesDecrypt: async (data, key, iv, mode = 'CBC') => {
    const keyBuffer = Buffer.from(key)
    const algorithm = mode === 'ECB'
      ? `aes-${keyBuffer.length * 8}-ecb`
      : `aes-${keyBuffer.length * 8}-cbc`

    const decipher = crypto.createDecipheriv(
      algorithm,
      keyBuffer,
      mode === 'ECB' ? '' : Buffer.from(iv || '')
    )

    let decrypted = decipher.update(data, 'base64', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  },

  /**
   * AES 解密（IV为Base64编码）
   * 适用于服务端随机生成的二进制IV
   * @param {string} cipher - Base64编码的密文
   * @param {string} key - 解密密钥
   * @param {string} ivB64 - Base64编码的IV
   * @param {string} [mode='CBC'] - 解密模式
   * @returns {Promise<string>} 解密后的明文
   */
  aesDecryptB64Iv: async (cipher, key, ivB64, mode = 'CBC') => {
    const keyBuffer = Buffer.from(key)
    const ivBuffer = Buffer.from(ivB64, 'base64')
    const algorithm = mode === 'ECB'
      ? `aes-${keyBuffer.length * 8}-ecb`
      : `aes-${keyBuffer.length * 8}-cbc`

    const decipher = crypto.createDecipheriv(
      algorithm,
      keyBuffer,
      mode === 'ECB' ? '' : ivBuffer
    )

    let decrypted = decipher.update(cipher, 'base64', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  },

  /**
   * DES-CBC 加密
   * @param {string} data - 待加密的明文字符串
   * @param {string} key - 加密密钥（8字节）
   * @param {string} [iv] - 初始化向量（8字节）
   * @returns {Promise<string>} Base64编码的密文
   */
  desEncrypt: async (data, key, iv) => {
    const cipher = crypto.createCipheriv(
      'des-cbc',
      Buffer.from(key),
      Buffer.from(iv || '')
    )

    let encrypted = cipher.update(data, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    return encrypted
  },

  /**
   * DES-CBC 解密
   * @param {string} data - Base64编码的密文
   * @param {string} key - 解密密钥（8字节）
   * @param {string} [iv] - 初始化向量（8字节）
   * @returns {Promise<string>} 解密后的明文
   */
  desDecrypt: async (data, key, iv) => {
    const decipher = crypto.createDecipheriv(
      'des-cbc',
      Buffer.from(key),
      Buffer.from(iv || '')
    )

    let decrypted = decipher.update(data, 'base64', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }
}
