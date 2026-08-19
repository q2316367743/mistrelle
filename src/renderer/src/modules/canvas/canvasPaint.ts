import {
  CANVAS_ALIGNS,
  type CanvasAlign,
  type CanvasEffect,
  type CanvasPaint,
  type CanvasPointRef
} from './canvasTypes'

const ALIGN_SET: ReadonlySet<string> = new Set(CANVAS_ALIGNS)

/** AI 常把「顶边居中」写成 top-center，Leafer 只认 top / bottom / left / right */
const ALIGN_ALIASES = new Map<string, CanvasAlign>([
  ['top-center', 'top'],
  ['center-top', 'top'],
  ['bottom-center', 'bottom'],
  ['center-bottom', 'bottom'],
  ['left-center', 'left'],
  ['center-left', 'left'],
  ['right-center', 'right'],
  ['center-right', 'right'],
  ['middle', 'center']
])

const isCanvasAlign = (value: string): value is CanvasAlign => ALIGN_SET.has(value)

/** 过滤 undefined 字段，避免给 Leafer 传空值 */
export const compact = (obj: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value
  }
  return out
}

/**
 * 规范化渐变 from/to：合法方位 / {x,y} 原样；常见别名映射；未知字符串丢弃（Leafer 默认 top→bottom）。
 * 存量画布不会再走 batch_edit 校验，渲染层必须兜底，否则 AroundHelper 读 undefined.x。
 */
export const normalizePointRef = (value: unknown): CanvasPointRef | undefined => {
  if (value == null) return undefined
  if (typeof value === 'object' && !Array.isArray(value) && 'x' in value && 'y' in value) {
    const x = value.x
    const y = value.y
    if (typeof x === 'number' && typeof y === 'number') return { x, y }
    return undefined
  }
  if (typeof value !== 'string') return undefined
  const key = value.trim().toLowerCase()
  if (isCanvasAlign(key)) return key
  return ALIGN_ALIASES.get(key)
}

/** 解析 $name 调色板引用（纯色字符串或渐变 stops 内的颜色） */
const resolveColorString = (value: string, palette: Record<string, string>): string => {
  if (value.startsWith('$')) {
    const color = palette[value.slice(1)]
    if (color) return color
  }
  return value
}

export const resolvePaint = (
  paint: CanvasPaint | undefined,
  palette: Record<string, string>
): CanvasPaint | undefined => {
  if (paint == null) return undefined
  if (typeof paint === 'string') {
    // 显式 'none' = 无填充 / 无描边：直接省略属性，避免给 Canvas 赋非法颜色导致状态泄漏
    if (paint.trim() === 'none') return undefined
    return resolveColorString(paint, palette)
  }
  // 防御：渐变对象必须是合法结构（stops 数组），否则视为无效填充，避免渲染崩溃
  if (typeof paint !== 'object' || !Array.isArray(paint.stops) || paint.stops.length === 0)
    return undefined
  return {
    ...paint,
    from: normalizePointRef(paint.from),
    to: normalizePointRef(paint.to),
    stops: paint.stops.map((stop) =>
      typeof stop === 'string'
        ? resolveColorString(stop, palette)
        : { ...stop, color: resolveColorString(stop.color, palette) }
    )
  }
}

/** 效果数组 → Leafer shadow / innerShadow / blur / backgroundBlur 属性 */
export const toEffectsProps = (effects: CanvasEffect[] | undefined): Record<string, unknown> => {
  if (!Array.isArray(effects) || effects.length === 0) return {}
  const shadow: Array<Record<string, unknown>> = []
  const innerShadow: Array<Record<string, unknown>> = []
  const props: Record<string, unknown> = {}
  for (const effect of effects) {
    if (effect.visible === false) continue
    switch (effect.type) {
      case 'drop-shadow':
        shadow.push(
          compact({
            x: effect.x ?? 0,
            y: effect.y ?? 0,
            blur: effect.radius ?? 0,
            spread: effect.spread,
            color: effect.color ?? 'rgba(0,0,0,0.3)',
            visible: true
          })
        )
        break
      case 'inner-shadow':
        innerShadow.push(
          compact({
            x: effect.x ?? 0,
            y: effect.y ?? 0,
            blur: effect.radius ?? 0,
            spread: effect.spread,
            color: effect.color ?? 'rgba(0,0,0,0.3)',
            visible: true
          })
        )
        break
      case 'layer-blur':
        props.blur = { radius: effect.radius ?? 0 }
        break
      case 'background-blur':
        props.backgroundBlur = { radius: effect.radius ?? 0 }
        break
    }
  }
  if (shadow.length) props.shadow = shadow
  if (innerShadow.length) props.innerShadow = innerShadow
  return props
}
