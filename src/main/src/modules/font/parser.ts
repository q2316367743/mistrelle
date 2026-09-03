/**
 * 字体 name 表解析（TTF/OTF/TTC）——原 src-utools/src/font.js 的独立拆分。
 * 解析家族名（nameID=16 排版家族 > nameID=1 家族；platformID 优先级 Windows 0x409 > Unicode > Mac）。
 */
import { open } from 'node:fs/promises'
import iconv from 'iconv-lite'

const readU16 = (buf: Buffer, off: number): number => buf.readUInt16BE(off)
const readU32 = (buf: Buffer, off: number): number => buf.readUInt32BE(off)

/** 从 fd 的指定偏移读取若干字节（超出文件时返回实际读到的部分） */
const readRange = async (fd: import('node:fs/promises').FileHandle, offset: number, length: number): Promise<Buffer> => {
  const buf = Buffer.alloc(length)
  const { bytesRead } = await fd.read(buf, 0, length, offset)
  return buf.subarray(0, bytesRead)
}

interface NameCandidate {
  priority: number
  text: string
}

/** 解析 name 表（偏移相对本表起点），返回家族名 */
const parseNameTable = (buf: Buffer): string | null => {
  if (buf.length < 6) return null
  const count = readU16(buf, 2)
  const stringOffset = readU16(buf, 4)
  const candidates: NameCandidate[] = []
  for (let i = 0; i < count; i++) {
    const rec = 6 + i * 12
    if (rec + 12 > buf.length) break
    const platformID = readU16(buf, rec)
    const encodingID = readU16(buf, rec + 2)
    const languageID = readU16(buf, rec + 4)
    const nameID = readU16(buf, rec + 6)
    const length = readU16(buf, rec + 8)
    const offset = readU16(buf, rec + 10)
    if (nameID !== 1 && nameID !== 16) continue
    const start = stringOffset + offset
    if (start + length > buf.length) continue
    const strBuf = buf.subarray(start, start + length)
    let text: string | null = null
    if (platformID === 3 && encodingID === 1) text = iconv.decode(strBuf, 'utf-16be')
    else if (platformID === 0) text = iconv.decode(strBuf, 'utf-16be')
    else if (platformID === 1) text = iconv.decode(strBuf, 'macintosh')
    if (!text || !text.trim()) continue
    const priority =
      (nameID === 16 ? 0 : 10) +
      (platformID === 3 && encodingID === 1 && languageID === 0x409
        ? 0
        : platformID === 3 || platformID === 0
          ? 1
          : 2)
    candidates.push({ priority, text: text.trim() })
  }
  if (!candidates.length) return null
  candidates.sort((a, b) => a.priority - b.priority)
  return candidates[0].text
}

/** 解析单个 sfnt 字体（TTC 内的 table offset 是相对文件开头的绝对偏移，不再加 sfntOffset） */
const parseSfntFamilyName = async (
  fd: import('node:fs/promises').FileHandle,
  sfntOffset: number
): Promise<string | null> => {
  const head = await readRange(fd, sfntOffset, 12)
  if (head.length < 12) return null
  const numTables = readU16(head, 4)
  const dir = await readRange(fd, sfntOffset + 12, numTables * 16)
  if (dir.length < numTables * 16) return null
  let nameOffset = 0
  let nameLength = 0
  for (let i = 0; i < numTables; i++) {
    const rec = dir.subarray(i * 16, i * 16 + 16)
    if (rec.toString('ascii', 0, 4) === 'name') {
      nameOffset = readU32(rec, 8)
      nameLength = readU32(rec, 12)
      break
    }
  }
  if (!nameOffset || !nameLength) return null
  const nameBuf = await readRange(fd, nameOffset, nameLength)
  return parseNameTable(nameBuf)
}

/** 解析字体文件家族名；无法解析返回 null（WOFF/WOFF2 内部结构不同，返回 null） */
export const parseFontFamilyName = async (filePath: string): Promise<string | null> => {
  let fd: import('node:fs/promises').FileHandle | undefined
  try {
    fd = await open(filePath, 'r')
    const head = await readRange(fd, 0, 12)
    if (head.length < 12) return null
    const tag = head.toString('ascii', 0, 4)
    if (tag === 'ttcf') {
      const ttcHead = await readRange(fd, 0, 16)
      if (ttcHead.length < 12) return null
      const numFonts = readU32(ttcHead, 8)
      const offsetsBuf = await readRange(fd, 12, numFonts * 4)
      for (let i = 0; i < numFonts; i++) {
        const name = await parseSfntFamilyName(fd, readU32(offsetsBuf, i * 4))
        if (name) return name
      }
      return null
    }
    if (tag === 'wOFF' || tag === 'wOF2') return null
    return await parseSfntFamilyName(fd, 0)
  } catch {
    return null
  } finally {
    await fd?.close().catch(() => {})
  }
}
