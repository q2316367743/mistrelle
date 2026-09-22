/**
 * sharp 图像处理封装（main 进程，原 utools 内置 sharp 的替代）。
 *
 * 与原 src-utools/src/inject.js 的 inject.sharp 契约 1:1：
 * - metadata(input)：读取宽高 / 格式
 * - crop(input, region, output)：裁剪区域并输出 PNG
 * - removeBackground(input, options, output)：从四边 flood-fill 去除连续背景色（算法完整移植）
 * - colorMap(input, gridSize, top)：网格主色 + LAB 感知色差突兀区域检测（纯 JS，一次 raw 读取）
 */
import sharp from 'sharp'
import {
  MOSAIC_BLUR_PX,
  MOSAIC_BLUR_RANGE,
  MOSAIC_CELL_PX,
  MOSAIC_CELL_RANGE
} from '@common/types/mosaic'
import type {
  SharpColorMapResult,
  SharpCoverOptions,
  SharpMaskResult,
  SharpMetadata,
  SharpRegion,
  SharpRemoveBackgroundResult
} from '~/modules/sharp/sharpChannels'

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

// ── colorMap ───────────────────────────────────────────────

const toHex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')

/** sRGB → CIELAB（D65 白点），用于感知一致的颜色差异度量 */
const rgbToLab = (r: number, g: number, b: number): [number, number, number] => {
  const linear = (c: number): number => {
    const s = c / 255
    return s > 0.04045 ? Math.pow((s + 0.055) / 1.055, 2.4) : s / 12.92
  }
  const rl = linear(r)
  const gl = linear(g)
  const bl = linear(b)
  const x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175
  const z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) / 1.08883
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

const deltaE = (a: [number, number, number], b: [number, number, number]): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/**
 * 颜色分布分析：将图片按宽高比缩放到 gridSize 长边网格，返回全局主色 palette
 * 与「突兀区域」anomalies（每格与其 8 邻域的 LAB ΔE76 最大色差，取 Top-N 降序）。
 * 网格单元经 resize 下采样即得该区域平均色，一次 raw 读取 + 纯 JS 计算。
 */
export const sharpColorMap = async (
  input: string,
  gridSize: number,
  top: number
): Promise<SharpColorMapResult> => {
  const meta = await sharp(input).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (!width || !height) {
    throw new Error('无法解析图片尺寸')
  }

  const cols = Math.max(4, Math.min(48, Math.round(gridSize) || 24))
  const rows = Math.max(4, Math.round((cols * height) / width))
  const { data, info } = await sharp(input)
    .resize(cols, rows, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = info.channels || 4

  const isOpaque = (r: number, c: number): boolean => data[(r * cols + c) * channels + 3] >= 128
  const cellRgb = (r: number, c: number): [number, number, number] => {
    const o = (r * cols + c) * channels
    return [data[o], data[o + 1], data[o + 2]]
  }

  const labs: Array<Array<[number, number, number] | null>> = []
  for (let r = 0; r < rows; r++) {
    const row: Array<[number, number, number] | null> = []
    for (let c = 0; c < cols; c++) {
      row.push(isOpaque(r, c) ? rgbToLab(...cellRgb(r, c)) : null)
    }
    labs.push(row)
  }

  const count = new Map<string, number>()
  let total = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!labs[r][c]) continue
      const key = `${cellRgb(r, c)[0]},${cellRgb(r, c)[1]},${cellRgb(r, c)[2]}`
      count.set(key, (count.get(key) || 0) + 1)
      total++
    }
  }
  const palette = [...count.entries()]
    .map(([key, n]) => {
      const [r, g, b] = key.split(',').map(Number)
      return { hex: toHex(r, g, b), ratio: Number((n / total).toFixed(3)) }
    })
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, top)

  const deviations: Array<{ row: number; col: number; lab: [number, number, number]; maxD: number }> = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lab = labs[r][c]
      if (!lab) continue
      let maxD = 0
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const nr = r + dr
          const nc = c + dc
          const nb = labs[nr]?.[nc]
          if (!nb) continue
          const d = deltaE(lab, nb)
          if (d > maxD) maxD = d
        }
      }
      deviations.push({ row: r, col: c, lab, maxD })
    }
  }

  const cellX = (col: number): number => Math.floor((col / cols) * width)
  const cellY = (row: number): number => Math.floor((row / rows) * height)
  const anomalies = deviations
    .sort((a, b) => b.maxD - a.maxD)
    .slice(0, top)
    .map(({ row, col, maxD }) => {
      const x = cellX(col)
      const y = cellY(row)
      const xEnd = col === cols - 1 ? width : cellX(col + 1)
      const yEnd = row === rows - 1 ? height : cellY(row + 1)
      const [r, g, b] = cellRgb(row, col)
      return {
        row,
        col,
        x,
        y,
        width: Math.max(1, xEnd - x),
        height: Math.max(1, yEnd - y),
        color: toHex(r, g, b),
        deviation: Number(maxD.toFixed(1))
      }
    })

  return { width, height, cols, rows, palette, anomalies }
}

/**
 * 区域遮盖（马赛克 / 毛玻璃）：整图先生成「遮盖底图」——
 * - mosaic：按块边长粗化（缩到 1/N 再 nearest 放大回原尺寸）得到统一网格的马赛克底图
 * - blur：整图高斯模糊（sigma = 半径，与渲染层 `blur()` 半径同义）
 * 再把各区域内像素从底图拷贝回原图，输出 PNG。用掩码 + raw 一次遍历实现，
 * 支持大量区域（笔刷行段）不劣化。区域越界部分自动钳制到图片范围内。
 *
 * ⚠️ 粗化必须拆成两条 pipeline：sharp 同一条 pipeline 只允许一次 resize
 * （官方文档：Only one resize can occur per pipeline，先前的 resize 会被忽略）。
 * 写在一条里会只剩「按原尺寸 nearest 放大」＝恒等变换，产物与原图逐像素相同（马赛克静默失效）。
 */
export const sharpMask = async (
  input: string,
  regions: SharpRegion[],
  output: string,
  cover?: SharpCoverOptions
): Promise<SharpMaskResult> => {
  if (!regions.length) throw new Error('遮盖区域列表为空')
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const width = info.width
  const height = info.height
  // 通道数按图片实际值（彩色 4 / 灰度 2）：两个缓冲同源，通道数必然一致
  const channels = info.channels
  let masked: Buffer
  if (cover?.style === 'blur') {
    masked = await buildBlurBase(input, cover.blurPx)
  } else {
    // 马赛克底图：第一步缩到 1/N（默认核做块内平均），第二步 nearest 放大回原尺寸
    const cell = clampRange(cover?.cellPx, MOSAIC_CELL_PX, MOSAIC_CELL_RANGE)
    const cols = Math.max(1, Math.round(width / cell))
    const rows = Math.max(1, Math.round(height / cell))
    const small = await sharp(input)
      .ensureAlpha()
      .resize(cols, rows, { fit: 'fill' })
      .raw()
      .toBuffer()
    masked = await sharp(small, { raw: { width: cols, height: rows, channels } })
      .resize(width, height, { fit: 'fill', kernel: 'nearest' })
      .raw()
      .toBuffer()
  }
  // 区域掩码：标记需要替换的像素（行遍历填充，对矩形连续段 memset 友好）
  const mask = new Uint8Array(width * height)
  for (const region of regions) {
    const left = Math.max(0, Math.min(Math.round(region.left), width - 1))
    const top = Math.max(0, Math.min(Math.round(region.top), height - 1))
    const w = Math.max(1, Math.min(Math.round(region.width), width - left))
    const h = Math.max(1, Math.min(Math.round(region.height), height - top))
    for (let y = top; y < top + h; y++) {
      mask.fill(1, y * width + left, y * width + left + w)
    }
  }
  // 逐像素替换：命掩码处从遮盖底图取同位置像素（含 alpha，逐通道拷贝）
  for (let i = 0, px = 0; i < mask.length; i++, px += channels) {
    if (!mask[i]) continue
    for (let c = 0; c < channels; c++) {
      data[px + c] = masked[px + c]
    }
  }
  await sharp(data, { raw: { width, height, channels } }).png().toFile(output)
  return { width, height, applied: regions.length }
}

/** 毛玻璃底图：整图高斯模糊（sigma = 半径，与渲染层 CSS blur 半径同义） */
const buildBlurBase = async (input: string, blurPx: number | undefined): Promise<Buffer> => {
  const sigma = clampRange(blurPx, MOSAIC_BLUR_PX, MOSAIC_BLUR_RANGE)
  return sharp(input).ensureAlpha().blur(sigma).raw().toBuffer()
}

/** 数值缺省 / 越界 / 脏数据一律回落到默认值与合法范围 */
const clampRange = (
  value: number | undefined,
  fallback: number,
  [min, max]: readonly [number, number]
): number => {
  const base = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, base))
}
