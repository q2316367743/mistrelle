/**
 * PPT 元素 schema —— SlideNode 公共属性（TypeBox 单一源，对齐 POM 官方 nodes 文档）：
 * - 元素结构统一为 { tag, attr, child }：tag 即 XML 标签名，attr 为属性对象，child 为子元素数组或文本字符串
 * - 对象型属性（border / shadow / padding / fill / glow 等）用**点表示法**扁平展开到 attr
 *   （如 border.color、shadow.blur），与 POM XML 的点表示法属性一一对应，导出时原样输出
 * - attr 值允许 string / number / boolean（AI 友好），落盘前统一转为字符串
 * - 校验与模型参数描述见 pptSchemas.ts
 */
import { Type } from '@sinclair/typebox'

// ── 点表示法分组（子键对齐 pom 的 coercion 规则） ──────────

/** 边距：标量（统一数值）或 top / right / bottom / left 单侧（点表示法） */
export const edgeAttrs = (prefix: 'padding' | 'margin') => ({
  [prefix]: Type.Optional(Type.Union([Type.Number(), Type.String()], { description: `${prefix === 'padding' ? '内' : '外'}边距：统一数值` })),
  [`${prefix}.top`]: Type.Optional(Type.Number({ description: '上侧' })),
  [`${prefix}.right`]: Type.Optional(Type.Number({ description: '右侧' })),
  [`${prefix}.bottom`]: Type.Optional(Type.Number({ description: '下侧' })),
  [`${prefix}.left`]: Type.Optional(Type.Number({ description: '左侧' }))
})

const DASH_TYPES = [
  Type.Literal('solid'),
  Type.Literal('dash'),
  Type.Literal('dashDot'),
  Type.Literal('lgDash'),
  Type.Literal('lgDashDot'),
  Type.Literal('lgDashDotDot'),
  Type.Literal('sysDash'),
  Type.Literal('sysDot')
] as const

/** 边框点表示法属性（border / borderTop / borderRight / borderBottom / borderLeft / cellBorder） */
export const borderAttrs = (
  prefix: 'border' | 'borderTop' | 'borderRight' | 'borderBottom' | 'borderLeft' | 'cellBorder'
) => ({
  [`${prefix}.color`]: Type.Optional(Type.String({ description: '颜色（6 位 hex 无 #，可 $token）' })),
  [`${prefix}.width`]: Type.Optional(Type.Number({ description: '宽度（px）' })),
  [`${prefix}.dashType`]: Type.Optional(Type.Union([...DASH_TYPES], { description: '虚线样式' }))
})

/** 阴影点表示法属性（shadow.*） */
export const shadowAttrs = {
  'shadow.type': Type.Optional(Type.Union([Type.Literal('outer'), Type.Literal('inner')], { description: '外阴影 / 内阴影' })),
  'shadow.blur': Type.Optional(Type.Number({ description: '模糊半径' })),
  'shadow.offset': Type.Optional(Type.Number({ description: '偏移距离' })),
  'shadow.angle': Type.Optional(Type.Number({ description: '偏移角度（度）' })),
  'shadow.color': Type.Optional(Type.String({ description: '颜色' })),
  'shadow.opacity': Type.Optional(Type.Number({ minimum: 0, maximum: 1, description: '不透明度 0-1' }))
}

/** 发光点表示法属性（glow.*，Text / Shape） */
export const glowAttrs = {
  'glow.size': Type.Optional(Type.Number({ description: '发光尺寸' })),
  'glow.opacity': Type.Optional(Type.Number({ description: '不透明度' })),
  'glow.color': Type.Optional(Type.String({ description: '发光色' }))
}

/** 描边点表示法属性（outline.*，Text） */
export const outlineAttrs = {
  'outline.size': Type.Optional(Type.Number({ description: '描边尺寸' })),
  'outline.color': Type.Optional(Type.String({ description: '描边色' }))
}

// ── 公共属性（attr 段） ─────────────────────────────────────

/** 所有节点公共属性（布局 / 背景 / 边框 / 定位；对象属性为点表示法） */
export const commonAttrs = {
  id: Type.Optional(Type.String({ description: '页面内唯一标识（Arrow 连接用）' })),
  w: Type.Optional(Type.Union([Type.Number(), Type.Literal('max'), Type.String()], { description: '宽：像素数字 | "max"（沿主轴撑满） | "50%"（百分比）' })),
  h: Type.Optional(Type.Union([Type.Number(), Type.Literal('max'), Type.String()], { description: '高：像素数字 | "max" | "50%"（百分比）' })),
  grow: Type.Optional(Type.Number({ description: '兄弟间主轴剩余空间分配比例（同 flex-grow）' })),
  minW: Type.Optional(Type.Number()),
  maxW: Type.Optional(Type.Number()),
  minH: Type.Optional(Type.Number()),
  maxH: Type.Optional(Type.Number()),
  ...edgeAttrs('padding'),
  ...edgeAttrs('margin'),
  backgroundColor: Type.Optional(Type.String({ description: '背景色（6 位 hex 无 #，可 $token）' })),
  backgroundGradient: Type.Optional(
    Type.String({ description: 'CSS 渐变，如 linear-gradient(135deg, #1E40AF 0%, #0EA5E9 100%)' })
  ),
  'backgroundImage.src': Type.Optional(Type.String({ description: '背景图地址 / 本地路径 / base64' })),
  'backgroundImage.sizing': Type.Optional(Type.Union([Type.Literal('cover'), Type.Literal('contain')], { description: 'cover 铺满（默认）/ contain 完整容纳' })),
  ...borderAttrs('border'),
  ...borderAttrs('borderTop'),
  ...borderAttrs('borderRight'),
  ...borderAttrs('borderBottom'),
  ...borderAttrs('borderLeft'),
  borderRadius: Type.Optional(Type.Number({ description: '圆角半径（px）' })),
  opacity: Type.Optional(Type.Number({ minimum: 0, maximum: 1, description: '背景不透明度 0-1' })),
  zIndex: Type.Optional(Type.Number({ description: '层级（越大越靠上）' })),
  position: Type.Optional(Type.Union([Type.Literal('relative'), Type.Literal('absolute')], { description: '定位模式' })),
  top: Type.Optional(Type.Number()),
  right: Type.Optional(Type.Number()),
  bottom: Type.Optional(Type.Number()),
  left: Type.Optional(Type.Number()),
  alignSelf: Type.Optional(
    Type.Union(
      [Type.Literal('auto'), Type.Literal('start'), Type.Literal('center'), Type.Literal('end'), Type.Literal('stretch')],
      { description: '覆盖父级 alignItems' }
    )
  ),
  rotate: Type.Optional(Type.Number({ description: '旋转角度（度，顺时针；仅 Text/Shape/Image/Icon）' })),
  ...shadowAttrs
}

/** 文本类属性（Text / Shape 内文本 / Li / Td 共用；underline 支持布尔或 style/color 点表示法） */
export const textAttrs = {
  fontSize: Type.Optional(Type.Number({ description: '字号（px）' })),
  color: Type.Optional(Type.String({ description: '文本色（6 位 hex 无 #，可 $token）' })),
  textAlign: Type.Optional(Type.Union([Type.Literal('left'), Type.Literal('center'), Type.Literal('right')])),
  bold: Type.Optional(Type.Boolean()),
  italic: Type.Optional(Type.Boolean()),
  strike: Type.Optional(Type.Boolean()),
  underline: Type.Optional(Type.Boolean({ description: '下划线（true 或改用 underline.style / underline.color 细调）' })),
  'underline.style': Type.Optional(Type.String()),
  'underline.color': Type.Optional(Type.String()),
  highlight: Type.Optional(Type.String({ description: '文本高亮色' })),
  fontFamily: Type.Optional(Type.String()),
  lineHeight: Type.Optional(Type.Number({ description: '行高倍率（默认 1.3）' })),
  letterSpacing: Type.Optional(Type.Number({ description: '字间距（px）' })),
  subscript: Type.Optional(Type.Boolean()),
  superscript: Type.Optional(Type.Boolean())
}

/** 通用内容段：child（文本字符串或子元素数组） */
export const childUnion = (Self: unknown) =>
  Type.Optional(
    Type.Union(
      [Type.String({ description: '文本内容（如 "Title"）' }), Type.Array(Self as never, { description: '子元素（布局顺序即渲染顺序）' })],
      { description: '内容：文本字符串或子元素数组' }
    )
  )
