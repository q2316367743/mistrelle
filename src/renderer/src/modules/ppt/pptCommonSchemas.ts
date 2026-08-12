/**
 * PPT 元素 schema 定义 —— TypeBox 单一源（对齐 POM 官方 nodes 文档）：
 * - 节点 type 枚举（text / vstack / hstack / icon / shape / image / ul / ol / layer / line /
 *   arrow / table / chart / timeline / flow / tree / matrix / processArrow / pyramid / svg）
 * - additionalProperties: false 拒绝未知字段；校验与模型参数描述见 pptSchemas.ts
 */
import { Type } from '@sinclair/typebox'

// ── 公共子 schema ──────────────────────────────────────────

/** w / h：像素数字 | "max"（沿主轴撑满） | "50%"（百分比） */
export const sizeSchema = Type.Union([Type.Number(), Type.Literal('max'), Type.String()])

export const edgeSchema = Type.Object(
  {
    top: Type.Optional(Type.Number()),
    right: Type.Optional(Type.Number()),
    bottom: Type.Optional(Type.Number()),
    left: Type.Optional(Type.Number())
  },
  { description: '单侧值：top / right / bottom / left' }
)

export const borderSchema = Type.Object(
  {
    color: Type.Optional(Type.String({ description: '颜色（6 位 hex 无 #，可 $token）' })),
    width: Type.Optional(Type.Number({ description: '宽度（px）' })),
    dashType: Type.Optional(
      Type.Union(
        [
          Type.Literal('solid'),
          Type.Literal('dash'),
          Type.Literal('dashDot'),
          Type.Literal('lgDash'),
          Type.Literal('lgDashDot'),
          Type.Literal('lgDashDotDot'),
          Type.Literal('sysDash'),
          Type.Literal('sysDot')
        ],
        { description: '虚线样式' }
      )
    )
  },
  { description: '边框：color / width / dashType（点表示法）' }
)

export const shadowSchema = Type.Object(
  {
    type: Type.Optional(Type.Union([Type.Literal('outer'), Type.Literal('inner')], { description: '外阴影 / 内阴影' })),
    blur: Type.Optional(Type.Number({ description: '模糊半径' })),
    offset: Type.Optional(Type.Number({ description: '偏移距离' })),
    angle: Type.Optional(Type.Number({ description: '偏移角度（度）' })),
    color: Type.Optional(Type.String({ description: '颜色' })),
    opacity: Type.Optional(Type.Number({ minimum: 0, maximum: 1, description: '不透明度 0-1' }))
  },
  { description: '阴影：type / blur / offset / angle / color / opacity（点表示法）' }
)

/** 所有节点公共属性（布局 / 背景 / 边框 / 定位） */
export const commonProps = {
  id: Type.Optional(Type.String({ description: '页面内唯一标识（Arrow 连接用）' })),
  w: Type.Optional(sizeSchema),
  h: Type.Optional(sizeSchema),
  grow: Type.Optional(Type.Number({ description: '兄弟间主轴剩余空间分配比例（同 flex-grow）' })),
  minW: Type.Optional(Type.Number()),
  maxW: Type.Optional(Type.Number()),
  minH: Type.Optional(Type.Number()),
  maxH: Type.Optional(Type.Number()),
  padding: Type.Optional(Type.Union([Type.Number(), edgeSchema], { description: '内边距：统一数值或单侧' })),
  margin: Type.Optional(Type.Union([Type.Number(), edgeSchema], { description: '外边距：统一数值或单侧' })),
  backgroundColor: Type.Optional(Type.String({ description: '背景色（6 位 hex 无 #，可 $token）' })),
  backgroundGradient: Type.Optional(
    Type.String({ description: 'CSS 渐变，如 linear-gradient(135deg, #1E40AF 0%, #0EA5E9 100%)' })
  ),
  backgroundImage: Type.Optional(
    Type.Object(
      {
        src: Type.String({ description: '图片地址 / 本地路径 / base64' }),
        sizing: Type.Optional(Type.Union([Type.Literal('cover'), Type.Literal('contain')], { description: 'cover 铺满（默认）/ contain 完整容纳' }))
      },
      { description: '背景图' }
    )
  ),
  border: Type.Optional(borderSchema),
  borderTop: Type.Optional(borderSchema),
  borderRight: Type.Optional(borderSchema),
  borderBottom: Type.Optional(borderSchema),
  borderLeft: Type.Optional(borderSchema),
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
  shadow: Type.Optional(shadowSchema),
  rotate: Type.Optional(Type.Number({ description: '旋转角度（度，顺时针；仅 Text/Shape/Image/Icon）' }))
}

/** 文本类属性（Text / Shape 内文本 / Ul / Ol / Li / Td 共用） */
export const textProps = {
  fontSize: Type.Optional(Type.Number({ description: '字号（px）' })),
  color: Type.Optional(Type.String({ description: '文本色（6 位 hex 无 #，可 $token）' })),
  textAlign: Type.Optional(Type.Union([Type.Literal('left'), Type.Literal('center'), Type.Literal('right')])),
  bold: Type.Optional(Type.Boolean()),
  italic: Type.Optional(Type.Boolean()),
  strike: Type.Optional(Type.Boolean()),
  underline: Type.Optional(
    Type.Union([Type.Boolean(), Type.Object({ style: Type.Optional(Type.String()), color: Type.Optional(Type.String()) })])
  ),
  highlight: Type.Optional(Type.String({ description: '文本高亮色' })),
  fontFamily: Type.Optional(Type.String()),
  lineHeight: Type.Optional(Type.Number({ description: '行高倍率（默认 1.3）' })),
  letterSpacing: Type.Optional(Type.Number({ description: '字间距（px）' })),
  subscript: Type.Optional(Type.Boolean()),
  superscript: Type.Optional(Type.Boolean())
}
