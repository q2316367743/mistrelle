/**
 * sharp 图像处理封装（main 进程，原 utools 内置 sharp 的替代）。
 *
 * 与原 src-utools/src/inject.js 的 inject.sharp 契约 1:1：
 * - metadata(input)：读取宽高 / 格式
 * - crop(input, region, output)：裁剪区域并输出 PNG
 * - removeBackground(input, options, output)：从四边 flood-fill 去除连续背景色（算法完整移植）
 */
import sharp from 'sharp'
import type { SharpMetadata, SharpRegion, SharpRemoveBackgroundResult } from '~/channels'

/** 解析目标背景色：hex / rgb() / [r,g,b]，非法或缺省回退纯白 */
const parseTargetColor = (color: string | number[] | undefined): [number, number, number] => {
  if (Array.isArray(color)) {
    const r = Number(color[0])
    const g = Number(color[1])
    const b = Number(color[2])
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      return [Math.round(r), Math.round(g), Math.round(b)]
    }
    return [255, 255, 255]
  }
  if (typeof color === 'string') {
    const hex = /^#?([0-9a-fA-F]{6})$/.exec(color.trim())
    if (hex) {
      const n = parseInt(hex[1], 16)
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }
    const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(color.trim())
    if (rgb) {
      return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
    }
  }
  return [255, 255, 255]
}

/** 容差钳制到 0~255，非法回退默认 40 */
const clampTolerance = (t: unknown): number => {
  const n = Number(t)
  if (!Number.isFinite(n)) return 40
  return Math.max(0, Math.min(255, Math.round(n)))
}

export const sharpMetadata = async (input: string | Uint8Array): Promise<SharpMetadata> => {
  const meta = await sharp(input).metadata()
  return {
    format: meta.format,
    width: meta.width,
    height: meta.height,
    space: meta.space,
    channels: meta.channels
  }
}

export const sharpCrop = async (
  input: string,
  region: SharpRegion,
  output: string
): Promise<{ width?: number; height?: number }> => {
  const info = await sharp(input).extract(region).png().toFile(output)
  return { width: info.width, height: info.height }
}

/**
 * 去除图片「从外到内的连续背景色」（flood fill）：从四边边缘像素出发，凡与目标色
 * 在容差内且与边缘连通的像素全部置为透明。默认去纯白背景，color 可自定义任意颜色。
 * 算法与原 src-utools/src/inject.js removeBackground 完全一致（BFS + Uint8Array visited + Int32Array queue）。
 */
export const sharpRemoveBackground = async (
  input: string,
  options: { color?: string | number[]; tolerance?: unknown } | undefined,
  output: string
): Promise<SharpRemoveBackgroundResult> => {
  const opt = options || {}
  const [cr, cg, cb] = parseTargetColor(opt.color)
  const tolerance = clampTolerance(opt.tolerance)
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const width = info.width
  const height = info.height
  const total = width * height
  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0
  let removedPixels = 0

  const matchColor = (i: number): boolean => {
    const o = i * 4
    return (
      Math.abs(data[o] - cr) <= tolerance &&
      Math.abs(data[o + 1] - cg) <= tolerance &&
      Math.abs(data[o + 2] - cb) <= tolerance
    )
  }
  const enqueue = (i: number): void => {
    if (visited[i]) return
    visited[i] = 1
    queue[tail++] = i
  }

  for (let x = 0; x < width; x++) {
    enqueue(x)
    enqueue((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    enqueue(y * width)
    enqueue(y * width + (width - 1))
  }

  while (head < tail) {
    const i = queue[head++]
    if (!matchColor(i)) continue
    removedPixels++
    data[i * 4 + 3] = 0
    const x = i % width
    const y = (i - x) / width
    if (x > 0) enqueue(i - 1)
    if (x < width - 1) enqueue(i + 1)
    if (y > 0) enqueue(i - width)
    if (y < height - 1) enqueue(i + width)
  }

  await sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(output)
  return { width, height, removedPixels }
}
