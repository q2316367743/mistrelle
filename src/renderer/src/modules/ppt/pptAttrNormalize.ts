/**
 * PPT attr 别名规范化：把模型常写的 CSS / React 驼峰键转为 schema 点表示法或规范键，
 * 并在校验 / 落盘前尽量把「数字字符串」收成 number，减少「未定义字段 / 应为数字」往返。
 */
const EDGE_ALIASES: Record<string, string> = {
  marginTop: 'margin.top',
  marginRight: 'margin.right',
  marginBottom: 'margin.bottom',
  marginLeft: 'margin.left',
  paddingTop: 'padding.top',
  paddingRight: 'padding.right',
  paddingBottom: 'padding.bottom',
  paddingLeft: 'padding.left',
  'margin-top': 'margin.top',
  'margin-right': 'margin.right',
  'margin-bottom': 'margin.bottom',
  'margin-left': 'margin.left',
  'padding-top': 'padding.top',
  'padding-right': 'padding.right',
  'padding-bottom': 'padding.bottom',
  'padding-left': 'padding.left'
}

/** 纯数字字段：字符串 "16" / "1.2" → number（不含 max / 50% 等尺寸字面量） */
const NUMERIC_ATTR_KEYS = new Set([
  'gap',
  'grow',
  'fontSize',
  'letterSpacing',
  'lineHeight',
  'opacity',
  'borderRadius',
  'zIndex',
  'rotate',
  'top',
  'right',
  'bottom',
  'left',
  'minW',
  'maxW',
  'minH',
  'maxH',
  'margin.top',
  'margin.right',
  'margin.bottom',
  'margin.left',
  'padding.top',
  'padding.right',
  'padding.bottom',
  'padding.left',
  'border.width',
  'borderTop.width',
  'borderRight.width',
  'borderBottom.width',
  'borderLeft.width',
  'cellBorder.width',
  'shadow.blur',
  'shadow.offset',
  'shadow.angle',
  'shadow.opacity',
  'glow.size',
  'glow.opacity',
  'outline.size',
  'size'
])

const NUMBER_STRING_RE = /^-?\d+(\.\d+)?$/

const toBold = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value >= 600
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (v === 'true' || v === 'bold' || v === 'bolder') return true
    if (v === 'false' || v === 'normal' || v === 'lighter') return false
    if (NUMBER_STRING_RE.test(v)) return Number(v) >= 600
  }
  return false
}

const coerceNumberIfNeeded = (key: string, value: unknown): unknown => {
  if (typeof value !== 'string') return value
  if (!NUMERIC_ATTR_KEYS.has(key) && key !== 'padding' && key !== 'margin') return value
  const trimmed = value.trim()
  if (!NUMBER_STRING_RE.test(trimmed)) return value
  return Number(trimmed)
}

/** 就地规范化单个 attr 对象（键别名 + 数值字符串） */
export const normalizePptAttr = (attr: Record<string, unknown>): void => {
  for (const key of Object.keys(attr)) {
    const value = attr[key]

    if (key === 'fontWeight' || key === 'font-weight') {
      delete attr[key]
      if (!('bold' in attr)) attr.bold = toBold(value)
      continue
    }

    const canonical = EDGE_ALIASES[key]
    if (canonical) {
      delete attr[key]
      if (!(canonical in attr)) attr[canonical] = coerceNumberIfNeeded(canonical, value)
      continue
    }

    attr[key] = coerceNumberIfNeeded(key, value)
  }
}

/** 就地递归规范化 SlideNode 树（含 child 数组） */
export const normalizePptNodeTree = (value: unknown): void => {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach(normalizePptNodeTree)
    return
  }
  const node = value as { attr?: unknown; child?: unknown; patch?: unknown; overrides?: unknown; node?: unknown }
  if (node.attr && typeof node.attr === 'object' && !Array.isArray(node.attr)) {
    normalizePptAttr(node.attr as Record<string, unknown>)
  }
  if (node.child !== undefined) normalizePptNodeTree(node.child)
  if (node.node !== undefined) normalizePptNodeTree(node.node)
  if (node.patch !== undefined) normalizePptNodeTree(node.patch)
  if (node.overrides !== undefined) normalizePptNodeTree(node.overrides)
}
