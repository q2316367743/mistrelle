/**
 * SlideNode attr → CSS 映射（vueRender 渲染层的唯一样式来源）：
 * - attr 值落盘统一为字符串，此处解析为 CSS（数字字符串、点表示法对象属性）
 * - 颜色支持 $token 引用（theme 令牌表解析），产出带 # 的标准 hex/rgba
 * - 快照（snapshot.ts）复用同一套解析函数，保证预览与导出的样式语义一致：
 *   CSS 负责布局与继承，快照负责把 attr 语义 + DOM 几何固化成绝对坐标
 */
import type { CSSProperties } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'

// ── 基础解析 ─────────────────────────────────────────────

/** 解析 attr 数值：缺省/非法时返回 undefined */
export function attrNum(attr: Record<string, string>, key: string): number | undefined
/** 解析 attr 数值：缺省/非法时返回 fallback（返回类型收窄为 number） */
export function attrNum(attr: Record<string, string>, key: string, fallback: number): number
export function attrNum(
  attr: Record<string, string>,
  key: string,
  fallback?: number
): number | undefined {
  const raw = attr[key]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

/** attr 布尔值（'true'/'false' 字符串） */
export const attrBool = (attr: Record<string, string>, key: string): boolean | undefined => {
  const raw = attr[key]
  if (raw === undefined) return undefined
  return raw === 'true' || raw === 'true\n'
}

/**
 * 颜色解析：$token → theme hex；补 # 前缀；返回 CSS 可用颜色串。
 * 无效/缺省返回 undefined。
 */
export const resolveColor = (
  raw: string | undefined,
  theme: PptTheme
): string | undefined => {
  if (!raw) return undefined
  let value = raw.trim()
  if (value.startsWith('$')) {
    const token = value.slice(1)
    const resolved = theme[token]
    if (!resolved) return undefined
    value = resolved
  }
  if (value.startsWith('#')) return value
  if (value.startsWith('rgb') || value.startsWith('hsl')) return value
  // 6 位 / 8 位 hex（无 #）
  return /^[0-9a-fA-F]{3,8}$/.test(value) ? `#${value}` : value
}

/** 尺寸 attr（w/h）：数字 → px；'max' → 100%；'50%' → 百分比 */
const sizeValue = (raw: string | undefined): string | undefined => {
  if (raw === undefined || raw === '') return undefined
  if (raw === 'max') return '100%'
  if (/^-?\d+(\.\d+)?$/.test(raw)) return `${raw}px`
  return raw
}

/** 虚线样式 → CSS border-style（近似映射：点线族 → dotted，其余虚线族 → dashed） */
export const dashCss = (dashType: string | undefined): string | undefined => {
  if (!dashType || dashType === 'solid') return 'solid'
  if (dashType === 'sysDot' || dashType === 'dot') return 'dotted'
  return 'dashed'
}

/** 阴影角度（0 = 上，顺时针）→ CSS 偏移（屏幕 y 向下） */
const shadowOffset = (offset: number, angle: number): { dx: number; dy: number } => {
  const rad = (angle * Math.PI) / 180
  return { dx: offset * Math.sin(rad), dy: -offset * Math.cos(rad) }
}

/** 阴影 attr → CSS box-shadow（type inner 用 inset 近似） */
export const shadowCss = (attr: Record<string, string>, theme: PptTheme): string | undefined => {
  const blur = attrNum(attr, 'shadow.blur', NaN)
  if (!Number.isFinite(blur)) return undefined
  const offset = attrNum(attr, 'shadow.offset', 4)
  const angle = attrNum(attr, 'shadow.angle', 90)
  const opacity = attrNum(attr, 'shadow.opacity', 0.4)
  const color = resolveColor(attr['shadow.color'], theme) ?? 'rgba(0,0,0,1)'
  const { dx, dy } = shadowOffset(offset, angle)
  const alpha = Math.min(1, Math.max(0, opacity))
  const rgba = color.startsWith('#')
    ? hexToRgba(color, alpha)
    : color.startsWith('rgb')
      ? color
      : `rgba(0,0,0,${alpha})`
  const inset = attr['shadow.type'] === 'inner' ? 'inset ' : ''
  return `${inset}${dx}px ${dy}px ${blur}px 0 ${rgba}`
}

/** hex（#RGB/#RRGGBB/#RRGGBBAA）→ rgba() 串 */
export const hexToRgba = (hex: string, alpha: number): string => {
  let value = hex.slice(1)
  if (value.length === 3) value = [...value].map((c) => c + c).join('')
  if (value.length === 8) value = value.slice(0, 6)
  const r = parseInt(value.slice(0, 2), 16) || 0
  const g = parseInt(value.slice(2, 4), 16) || 0
  const b = parseInt(value.slice(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${alpha})`
}

/** 背景不透明度 attr（0-1，仅作用于背景色；无背景时回落到元素 opacity） */
export const bgAlpha = (attr: Record<string, string>): number | undefined => {
  const raw = attr.opacity
  if (raw === undefined) return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : undefined
}

// ── 公共样式（commonAttrs） ─────────────────────────────

/**
 * 公共属性 → CSS：尺寸 / grow / 边距 / 背景 / 边框 / 圆角 / 定位 / 旋转 / 阴影。
 * rotate 用 transform（绕中心，与 PPTX 语义一致）。
 */
export const commonStyle = (node: SlideNode, theme: PptTheme): CSSProperties => {
  const attr = node.attr
  const style: CSSProperties = {}
  const w = sizeValue(attr.w)
  const h = sizeValue(attr.h)
  if (w !== undefined) style.width = w
  if (h !== undefined) style.height = h
  const grow = attrNum(attr, 'grow', NaN)
  if (Number.isFinite(grow)) style.flexGrow = grow
  const minW = attrNum(attr, 'minW', NaN)
  if (Number.isFinite(minW)) style.minWidth = `${minW}px`
  const maxW = attrNum(attr, 'maxW', NaN)
  if (Number.isFinite(maxW)) style.maxWidth = `${maxW}px`
  const minH = attrNum(attr, 'minH', NaN)
  if (Number.isFinite(minH)) style.minHeight = `${minH}px`
  const maxH = attrNum(attr, 'maxH', NaN)
  if (Number.isFinite(maxH)) style.maxHeight = `${maxH}px`
  applyEdge(style, attr, 'padding')
  applyEdge(style, attr, 'margin')

  const alpha = bgAlpha(attr)
  const bgColor = resolveColor(attr.backgroundColor, theme)
  if (bgColor) {
    style.backgroundColor = alpha !== undefined ? hexToRgba(toHex(bgColor), alpha) : bgColor
  } else if (attr.backgroundGradient) {
    style.backgroundImage = attr.backgroundGradient
  } else if (alpha !== undefined) {
    style.opacity = alpha
  }
  applyBorders(style, attr, theme)
  const radius = attrNum(attr, 'borderRadius', NaN)
  if (Number.isFinite(radius)) style.borderRadius = `${radius}px`
  if (attr.zIndex !== undefined) style.zIndex = attrNum(attr, 'zIndex', 0)
  if (attr.position === 'absolute') {
    style.position = 'absolute'
    const top = attrNum(attr, 'top', NaN)
    if (Number.isFinite(top)) style.top = `${top}px`
    const left = attrNum(attr, 'left', NaN)
    if (Number.isFinite(left)) style.left = `${left}px`
    const right = attrNum(attr, 'right', NaN)
    if (Number.isFinite(right)) style.right = `${right}px`
    const bottom = attrNum(attr, 'bottom', NaN)
    if (Number.isFinite(bottom)) style.bottom = `${bottom}px`
  }
  if (attr.alignSelf && attr.alignSelf !== 'auto') {
    style.alignSelf =
      attr.alignSelf === 'start' ? 'flex-start' : attr.alignSelf === 'end' ? 'flex-end' : attr.alignSelf
  }
  const rotate = attrNum(attr, 'rotate', NaN)
  if (Number.isFinite(rotate)) style.transform = `rotate(${rotate}deg)`
  const shadow = shadowCss(attr, theme)
  if (shadow) style.boxShadow = shadow
  return style
}

/** padding / margin：统一值或四侧点表示法 */
const applyEdge = (
  style: CSSProperties,
  attr: Record<string, string>,
  prefix: 'padding' | 'margin'
): void => {
  const all = attr[prefix]
  if (all !== undefined && all !== '') {
    const n = Number(all)
    if (Number.isFinite(n)) style[prefix] = `${n}px`
    return
  }
  const top = attrNum(attr, `${prefix}.top`, NaN)
  if (Number.isFinite(top)) style[`${prefix}Top`] = `${top}px`
  const right = attrNum(attr, `${prefix}.right`, NaN)
  if (Number.isFinite(right)) style[`${prefix}Right`] = `${right}px`
  const bottom = attrNum(attr, `${prefix}.bottom`, NaN)
  if (Number.isFinite(bottom)) style[`${prefix}Bottom`] = `${bottom}px`
  const left = attrNum(attr, `${prefix}.left`, NaN)
  if (Number.isFinite(left)) style[`${prefix}Left`] = `${left}px`
}

/** 边框：统一 border + 四侧 borderTop/Right/Bottom/Left */
const applyBorders = (style: CSSProperties, attr: Record<string, string>, theme: PptTheme): void => {
  const sides = ['', 'Top', 'Right', 'Bottom', 'Left'] as const
  for (const side of sides) {
    const key = side === '' ? 'border' : `border${side}`
    const color = resolveColor(attr[`${key}.color`], theme)
    const width = attrNum(attr, `${key}.width`, NaN)
    if (!color && !Number.isFinite(width)) continue
    const css = `${Number.isFinite(width) ? width : 1}px ${dashCss(attr[`${key}.dashType`]) ?? 'solid'} ${color ?? 'transparent'}`
    if (side === '') style.border = css
    else if (side === 'Top') style.borderTop = css
    else if (side === 'Right') style.borderRight = css
    else if (side === 'Bottom') style.borderBottom = css
    else style.borderLeft = css
  }
}

// ── 文本样式（textAttrs） ──────────────────────────────

/** 文本默认值（与 schema 描述一致：字号 24 / 行距 1.3 / Noto Sans JP） */
export const TEXT_DEFAULTS = {
  fontSize: 24,
  lineHeight: 1.3,
  fontFamily: 'Noto Sans JP'
} as const

/**
 * 文本属性 → CSS。inheritKeys 声明可从父级（如 Ul → Li）回退的键。
 */
export const textStyle = (
  attr: Record<string, string>,
  theme: PptTheme,
  fallbackAttr?: Record<string, string>
): CSSProperties => {
  const eff = (key: string): string | undefined =>
    attr[key] !== undefined ? attr[key] : fallbackAttr?.[key]
  const style: CSSProperties = {}
  const fontSize = Number(eff('fontSize'))
  if (Number.isFinite(fontSize)) style.fontSize = `${fontSize}px`
  else style.fontSize = `${TEXT_DEFAULTS.fontSize}px`
  const color = resolveColor(eff('color'), theme)
  if (color) {
    if (eff('textGradient')) {
      // 文本渐变：背景裁切实现；导出侧降级为 color
      style.backgroundImage = eff('textGradient')
      style.WebkitBackgroundClip = 'text'
      style.backgroundClip = 'text'
      style.color = 'transparent'
    } else {
      style.color = color
    }
  }
  const align = eff('textAlign')
  if (align === 'left' || align === 'center' || align === 'right') style.textAlign = align
  if (attrBool(attr, 'bold')) style.fontWeight = '700'
  if (attrBool(attr, 'italic')) style.fontStyle = 'italic'
  const strike = attrBool(attr, 'strike')
  const underline = attrBool(attr, 'underline')
  if (strike || underline) {
    const lines = [
      ...(underline ? ['underline'] : []),
      ...(strike ? ['line-through'] : [])
    ]
    style.textDecorationLine = lines.join(' ') as CSSProperties['textDecorationLine']
    const uStyle = attr['underline.style']
    if (uStyle) style.textDecorationStyle = dashCss(uStyle) as CSSProperties['textDecorationStyle']
    const uColor = resolveColor(attr['underline.color'], theme)
    if (uColor) style.textDecorationColor = uColor
  }
  const highlight = resolveColor(eff('highlight'), theme)
  if (highlight) style.backgroundColor = highlight
  const fontFamily = eff('fontFamily')
  if (fontFamily) style.fontFamily = fontFamily
  else style.fontFamily = TEXT_DEFAULTS.fontFamily
  const lineHeight = Number(eff('lineHeight'))
  style.lineHeight = Number.isFinite(lineHeight) ? lineHeight : TEXT_DEFAULTS.lineHeight
  const letterSpacing = Number(eff('letterSpacing'))
  if (Number.isFinite(letterSpacing)) style.letterSpacing = `${letterSpacing}px`
  if (attrBool(attr, 'subscript')) {
    style.verticalAlign = 'sub'
    style.fontSize = '0.7em'
  } else if (attrBool(attr, 'superscript')) {
    style.verticalAlign = 'super'
    style.fontSize = '0.7em'
  }
  return style
}

/** 颜色串归一为 #RRGGBB（供快照导出用；rgba 白名单外走 rgb 解析） */
export const toHex = (color: string): string => {
  if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(color)) {
    return color.length === 9 ? color.slice(0, 7) : color
  }
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    return `#${[...color.slice(1)].map((c) => c + c).join('')}`
  }
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color)
  if (match) {
    const hex = (n: string) => Number(n).toString(16).padStart(2, '0')
    return `#${hex(match[1])}${hex(match[2])}${hex(match[3])}`
  }
  return color
}
