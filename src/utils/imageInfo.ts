/**
 * 图片文件信息解析：读取本地图片文件的格式与宽高（纯字节解析，不依赖 DOM / canvas）。
 * 用于 AI 为 image 节点设置正确的 width/height，替代像素 / 头部字节分析的临时脚本。
 */

export interface ImageInfo {
  /** 实际格式（按文件头 magic 判定）：png / jpeg / gif / bmp / webp / ico / svg */
  format: string
  width: number
  height: number
  /** 文件大小（字节） */
  size: number
}

const u8 = (buf: Uint8Array, offset: number): number => buf[offset] ?? 0
const u16BE = (buf: Uint8Array, offset: number): number => (u8(buf, offset) << 8) | u8(buf, offset + 1)
// 注意 `<<` 是 32 位有符号移位，高位（如 0x89）会变成负数，`>>> 0` 转回无符号再与字面量比较
const u32BE = (buf: Uint8Array, offset: number): number =>
  (((u8(buf, offset) << 24) | (u8(buf, offset + 1) << 16) | (u8(buf, offset + 2) << 8) | u8(buf, offset + 3)) >>> 0)
const u16LE = (buf: Uint8Array, offset: number): number => u8(buf, offset) | (u8(buf, offset + 1) << 8)
const i32LE = (buf: Uint8Array, offset: number): number =>
  (u8(buf, offset) | (u8(buf, offset + 1) << 8) | (u8(buf, offset + 2) << 16) | (u8(buf, offset + 3) << 24)) | 0

const ascii = (buf: Uint8Array, offset: number, len: number): string =>
  String.fromCharCode(...buf.slice(offset, offset + len))

/** PNG：签名 89 50 4E 47 0D 0A 1A 0A，IHDR 位于 offset 16（宽）/ 20（高） */
const parsePng = (buf: Uint8Array): { width: number; height: number } | null => {
  if (u32BE(buf, 0) !== 0x89504e47 || u32BE(buf, 4) !== 0x0d0a1a0a) return null
  return { width: u32BE(buf, 16), height: u32BE(buf, 20) }
}

/** JPEG：FF D8 FF 开头；扫描 marker 找 SOF0/1/2（C0/C1/C2）读取宽高 */
const parseJpeg = (buf: Uint8Array): { width: number; height: number } | null => {
  if (u8(buf, 0) !== 0xff || u8(buf, 1) !== 0xd8 || u8(buf, 2) !== 0xff) return null
  let offset = 2
  while (offset + 9 < buf.length) {
    if (u8(buf, offset) !== 0xff) {
      offset++
      continue
    }
    const marker = u8(buf, offset + 1)
    if (marker === 0xd8 || marker === 0x01) {
      offset += 2
      continue
    }
    // 带长度字段的段：FF XX LEN LEN(2 字节)
    const segLen = u16BE(buf, offset + 2)
    if (segLen < 2) return null
    // SOF0-C0 / SOF1-C1 / SOF2-C2：height@+5 / width@+7（均不含 FF XX）
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      if (offset + 9 > buf.length) return null
      return { height: u16BE(buf, offset + 5), width: u16BE(buf, offset + 7) }
    }
    offset += 2 + segLen
  }
  return null
}

/** GIF：GIF87a / GIF89a，宽 @6 高 @8（LE） */
const parseGif = (buf: Uint8Array): { width: number; height: number } | null => {
  const head = ascii(buf, 0, 6)
  if (head !== 'GIF87a' && head !== 'GIF89a') return null
  return { width: u16LE(buf, 6), height: u16LE(buf, 8) }
}

/** BMP：BM 头，宽 @18 高 @22（i32 LE，高度取绝对值） */
const parseBmp = (buf: Uint8Array): { width: number; height: number } | null => {
  if (ascii(buf, 0, 2) !== 'BM') return null
  return { width: i32LE(buf, 18), height: Math.abs(i32LE(buf, 22)) }
}

/** WebP：RIFF..WEBP，按 VP8X / VP8L / VP8 子块解析 */
const parseWebp = (buf: Uint8Array): { width: number; height: number } | null => {
  if (ascii(buf, 0, 4) !== 'RIFF' || ascii(buf, 8, 4) !== 'WEBP') return null
  const fourcc = ascii(buf, 12, 4)
  if (fourcc === 'VP8X') {
    // 24bit LE，存的是 (宽-1) / (高-1)
    const w = u8(buf, 24) | (u8(buf, 25) << 8) | (u8(buf, 26) << 16)
    const h = u8(buf, 27) | (u8(buf, 28) << 8) | (u8(buf, 29) << 16)
    return { width: w + 1, height: h + 1 }
  }
  if (fourcc === 'VP8L') {
    // 14bit LE 分割：宽 = bits 0-13，高 = bits 14-27
    const b0 = u8(buf, 21)
    const b1 = u8(buf, 22)
    const b2 = u8(buf, 23)
    const b3 = u8(buf, 24)
    const w = (b0 | ((b1 & 0x3f) << 8)) + 1
    const h = (((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10)) & 0x3fff) + 1
    return { width: w, height: h }
  }
  if (fourcc === 'VP8 ') {
    // 16bit 小端，存的是 (宽-1) / (高-1)
    const w = u16LE(buf, 26)
    const h = u16LE(buf, 28)
    if (w === 0 || h === 0) return null
    return { width: w + 1, height: h + 1 }
  }
  return null
}

/** ICO：00 00 01 00 头，首个目录项 width@6 / height@7（0 = 256） */
const parseIco = (buf: Uint8Array): { width: number; height: number } | null => {
  if (u8(buf, 0) !== 0 || u8(buf, 1) !== 0 || u8(buf, 2) !== 1 || u8(buf, 3) !== 0) return null
  const w = u8(buf, 6)
  const h = u8(buf, 7)
  return { width: w === 0 ? 256 : w, height: h === 0 ? 256 : h }
}

/** SVG：解析 width / height 属性或 viewBox="x y w h"，均支持带单位 */
const parseSvg = (text: string): { width: number; height: number } | null => {
  const num = (v: string | undefined): number | null => {
    if (!v) return null
    const m = v.trim().match(/^(-?\d+(?:\.\d+)?)/)
    return m ? Number(m[1]) : null
  }
  const width = num(text.match(/width\s*=\s*["']([^"']*)["']/i)?.[1])
  const height = num(text.match(/height\s*=\s*["']([^"']*)["']/i)?.[1])
  if (width != null && height != null && width > 0 && height > 0) return { width, height }
  const vb = text.match(/viewBox\s*=\s*["']\s*(-?\d+(?:\.\d+)?)\s+(?:-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/i)
  if (vb) {
    const w = Number(vb[2])
    const h = Number(vb[3])
    if (w > 0 && h > 0) return { width: w, height: h }
  }
  return null
}

/** 从文件字节解析图片信息；无法识别返回 null */
export const parseImageBytes = (buffer: ArrayBuffer): Omit<ImageInfo, 'size'> | null => {
  const buf = new Uint8Array(buffer)
  if (buf.length < 12) return null
  const parsers: Array<[string, () => { width: number; height: number } | null]> = [
    ['png', () => parsePng(buf)],
    ['jpeg', () => parseJpeg(buf)],
    ['gif', () => parseGif(buf)],
    ['bmp', () => parseBmp(buf)],
    ['webp', () => parseWebp(buf)],
    ['ico', () => parseIco(buf)]
  ]
  for (const [format, parse] of parsers) {
    const dims = parse()
    if (dims) return { format, width: dims.width, height: dims.height }
  }
  // SVG 是文本格式，单独解码判断
  const text = new TextDecoder('utf-8').decode(buf.subarray(0, Math.min(buf.length, 64 * 1024)))
  const svgDims = /<svg[\s>]/i.test(text) ? parseSvg(text) : null
  if (svgDims) return { format: 'svg', width: svgDims.width, height: svgDims.height }
  return null
}

/** 读取本地图片文件并解析格式 / 宽高 / 大小；失败返回 null */
export const readImageInfo = async (path: string): Promise<ImageInfo | null> => {
  try {
    const buffer = await window.preload.fs.readBinaryFile(path)
    const parsed = parseImageBytes(buffer)
    if (!parsed) return null
    return { ...parsed, size: buffer.byteLength }
  } catch {
    return null
  }
}
