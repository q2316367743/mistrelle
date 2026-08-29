/**
 * iconv 编码转换模块（preload）：原 src-utools/src/IconvAPI.js 的 TS 移植。
 * 纯函数封装（iconv-lite），无特权，留在 preload 侧。
 */
import iconv from 'iconv-lite'

/**
 * 解析 buffer 内容
 * @param buffer Buffer
 * @param charset 编码
 * @returns 字符串
 */
export const parseBuffer = (buffer: Buffer, charset: string): string => iconv.decode(buffer, charset)

/**
 * 解析 ArrayBuffer 内容
 * @param buffer ArrayBuffer
 * @param charset 编码
 * @returns 字符串
 */
export const parseArrayBuffer = (buffer: ArrayBuffer, charset: string): string =>
  iconv.decode(Buffer.from(buffer), charset)

/**
 * 编码转换
 * @param content 内容
 * @param source 原始编码
 * @param target 目标编码（默认 utf-8）
 * @returns 内容
 */
export const convertCharset = (content: string, source: string, target = 'utf-8'): string => {
  if (source.toUpperCase() === target.toUpperCase()) {
    // 编码一致
    return content
  }
  const buffer = iconv.encode(content, source)
  return parseBuffer(buffer, target)
}

export const iconvApi = { parseBuffer, parseArrayBuffer, convertCharset }
