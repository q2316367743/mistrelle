/**
 * PPT 基本节点元素 schema（TypeBox）——与 pptComplexElementSchemas（复杂节点）共同组成
 * pptElementSchemaT 递归联合（单一数据源，校验与模型参数描述共用）。
 * 公共属性见 pptCommonSchemas.ts；校验 / 转换见 pptSchemas.ts。
 */
import { Type } from '@sinclair/typebox'
import type { TSchema } from '@sinclair/typebox'
import { commonProps, textProps } from './pptCommonSchemas'
import {
  buildTableNode,
  buildChartNode,
  buildTimelineNode,
  buildFlowNode,
  buildTreeNode,
  buildMatrixNode,
  buildPyramidNode,
  buildProcessArrowNode,
  buildSvgNode
} from './pptComplexElementSchemas'

export const buildTextNode = (_Self: unknown) =>
  Type.Object(
    {
      type: Type.Literal('text'),
      text: Type.Optional(Type.String({ description: '文本内容' })),
      textGradient: Type.Optional(Type.String({ description: '文本渐变填充，优先于 color' })),
      glow: Type.Optional(
        Type.Object({ size: Type.Optional(Type.Number()), opacity: Type.Optional(Type.Number()), color: Type.Optional(Type.String()) })
      ),
      outline: Type.Optional(
        Type.Object({ size: Type.Optional(Type.Number()), color: Type.Optional(Type.String()) })
      ),
      ...textProps,
      ...commonProps
    },
    { additionalProperties: false, description: '文本节点（默认字号 24、行距 1.3、字体 Noto Sans JP）' }
  )

export const buildStackNode = (type: 'vstack' | 'hstack', Self: unknown) =>
  Type.Object(
    {
      type: Type.Literal(type),
      gap: Type.Optional(Type.Number({ description: '子元素间距' })),
      alignItems: Type.Optional(
        Type.Union([Type.Literal('start'), Type.Literal('center'), Type.Literal('end'), Type.Literal('stretch')], {
          description: '交叉轴对齐（默认 stretch）'
        })
      ),
      justifyContent: Type.Optional(
        Type.Union(
          [
            Type.Literal('start'),
            Type.Literal('center'),
            Type.Literal('end'),
            Type.Literal('spaceBetween'),
            Type.Literal('spaceAround'),
            Type.Literal('spaceEvenly')
          ],
          { description: '主轴对齐（默认 start）' }
        )
      ),
      flexWrap: Type.Optional(
        Type.Union([Type.Literal('nowrap'), Type.Literal('wrap'), Type.Literal('wrapReverse')], {
          description: '换行（默认 nowrap）'
        })
      ),
      children: Type.Optional(Type.Array(Self as never, { description: '子元素（布局顺序即渲染顺序）' })),
      ...commonProps
    },
    {
      additionalProperties: false,
      description: `${type === 'vstack' ? 'VStack 纵向布局容器' : 'HStack 横向布局容器'}（flexbox，页面根元素必选其一）`
    }
  )

export const buildIconNode = (_Self: unknown) =>
  Type.Object(
    {
      type: Type.Literal('icon'),
      name: Type.String({ description: 'lucide 图标名，如 rocket / check-circle / trending-up' }),
      size: Type.Optional(Type.Number({ description: '图标尺寸（默认 24）' })),
      color: Type.Optional(Type.String({ description: '图标色（默认 #000000）' })),
      variant: Type.Optional(
        Type.Union(
          [Type.Literal('circle-filled'), Type.Literal('circle-outlined'), Type.Literal('square-filled'), Type.Literal('square-outlined')],
          { description: '带底色变体' }
        )
      ),
      bgColor: Type.Optional(Type.String({ description: '变体底色（默认 #E0E0E0）' })),
      ...commonProps
    },
    { additionalProperties: false, description: '图标节点（lucide 内置库）' }
  )

export const buildShapeNode = (_Self: unknown) =>
  Type.Object(
    {
      type: Type.Literal('shape'),
      shapeType: Type.String({ description: '形状类型：roundRect / ellipse / triangle / diamond / star / heart 等' }),
      text: Type.Optional(Type.String({ description: '形状内文本' })),
      fill: Type.Optional(
        Type.Object(
          {
            color: Type.Optional(Type.String({ description: '填充色' })),
            transparency: Type.Optional(Type.Number({ minimum: 0, maximum: 1, description: '透明度 0-1（0 不透明）' }))
          },
          { description: '填充（区别于背景）' }
        )
      ),
      line: Type.Optional(
        Type.Object(
          {
            color: Type.Optional(Type.String()),
            width: Type.Optional(Type.Number()),
            dashType: Type.Optional(Type.String())
          },
          { description: '描边' }
        )
      ),
      glow: Type.Optional(
        Type.Object({ size: Type.Optional(Type.Number()), opacity: Type.Optional(Type.Number()), color: Type.Optional(Type.String()) })
      ),
      ...textProps,
      ...commonProps
    },
    { additionalProperties: false, description: '形状节点' }
  )

export const buildImageNode = (_Self: unknown) =>
  Type.Object(
    {
      type: Type.Literal('image'),
      src: Type.String({ description: '图片：base64 data URI 或本地绝对路径（禁止 http）' }),
      sizing: Type.Optional(
        Type.Object(
          {
            type: Type.Union([Type.Literal('contain'), Type.Literal('cover'), Type.Literal('crop')]),
            x: Type.Optional(Type.Number()),
            y: Type.Optional(Type.Number()),
            w: Type.Optional(Type.Number()),
            h: Type.Optional(Type.Number())
          },
          { description: 'contain / cover / crop（crop 需 x/y/w/h 像素）' }
        )
      ),
      ...commonProps
    },
    { additionalProperties: false, description: '图片节点' }
  )

export const buildListNode = (type: 'ul' | 'ol', _Self: unknown) =>
  Type.Object(
    {
      type: Type.Literal(type),
      items: Type.Optional(
        Type.Array(
          Type.Union([
            Type.String({ description: '列表项文本' }),
            Type.Object(
              {
                text: Type.Optional(Type.String()),
                ...textProps
              },
              { additionalProperties: false }
            )
          ]),
          { description: '列表项（Li），支持字符串或对象' }
        )
      ),
      ...(type === 'ol'
        ? {
            numberType: Type.Optional(Type.String({ description: '编号样式：arabicPlain / arabicPeriod / romanLcPeriod 等' })),
            numberStartAt: Type.Optional(Type.Number({ description: '起始编号（默认 1）' }))
          }
        : {}),
      ...textProps,
      ...commonProps
    },
    { additionalProperties: false, description: `${type === 'ul' ? '无序' : '有序'}列表节点（Li 子项）` }
  )

export const buildLayerNode = (Self: unknown) =>
  Type.Object(
    {
      type: Type.Literal('layer'),
      children: Type.Optional(Type.Array(Self as never, { description: '子元素（绝对定位，坐标相对 Layer 左上角）' })),
      ...commonProps
    },
    { additionalProperties: false, description: '绝对定位容器（子元素用 position="absolute" + top/left 定位）' }
  )

export const buildLineNode = (_Self: unknown) =>
  Type.Object(
    {
      type: Type.Literal('line'),
      x1: Type.Number(),
      y1: Type.Number(),
      x2: Type.Number(),
      y2: Type.Number(),
      color: Type.Optional(Type.String({ description: '线条色（默认 000000）' })),
      lineWidth: Type.Optional(Type.Number({ description: '线宽（默认 1）' })),
      dashType: Type.Optional(Type.String()),
      beginArrow: Type.Optional(Type.Union([Type.Boolean(), Type.Object({ type: Type.Optional(Type.String()) })])),
      endArrow: Type.Optional(Type.Union([Type.Boolean(), Type.Object({ type: Type.Optional(Type.String()) })])),
      ...commonProps
    },
    { additionalProperties: false, description: '线条节点（绝对坐标，不参与布局）' }
  )

export const buildArrowNode = (_Self: unknown) =>
  Type.Object(
    {
      type: Type.Literal('arrow'),
      from: Type.String({ description: '起点节点 id（Text 或 rect/roundRect/ellipse Shape）' }),
      to: Type.String({ description: '终点节点 id' }),
      color: Type.Optional(Type.String()),
      lineWidth: Type.Optional(Type.Number()),
      dashType: Type.Optional(Type.String()),
      beginArrow: Type.Optional(Type.Union([Type.Boolean(), Type.Object({ type: Type.Optional(Type.String()) })])),
      endArrow: Type.Optional(Type.Union([Type.Boolean(), Type.Object({ type: Type.Optional(Type.String()) })])),
      ...commonProps
    },
    { additionalProperties: false, description: '连接箭头节点（from/to 引用节点 id）' }
  )

// ── 元素 schema（递归联合，单一数据源） ─────────────────────

export const pptElementSchemaT = Type.Recursive(
  (Self) =>
    Type.Union(
      [
        buildTextNode(Self),
        buildStackNode('vstack', Self),
        buildStackNode('hstack', Self),
        buildIconNode(Self),
        buildShapeNode(Self),
        buildImageNode(Self),
        buildListNode('ul', Self),
        buildListNode('ol', Self),
        buildLayerNode(Self),
        buildLineNode(Self),
        buildArrowNode(Self),
        buildTableNode(Self),
        buildChartNode(Self),
        buildTimelineNode(Self),
        buildFlowNode(Self),
        buildTreeNode(Self),
        buildMatrixNode(Self),
        buildPyramidNode(Self),
        buildProcessArrowNode(Self),
        buildSvgNode(Self)
      ],
      { description: 'POM 幻灯片元素（页面内容节点，type 区分类型）' }
    ),
  { $id: 'PptElement' }
)

/** 页面元素数组 schema（1..N 个元素） */
export const pptElementsSchemaT = Type.Array(pptElementSchemaT, {
  minItems: 1,
  description: '页面元素数组（每个元素是 POM 节点；页面根元素必须是 VStack / HStack 布局容器）'
})

/**
 * 判别表：元素 type → 对应分支 schema（顶层元素按 type 判别做**精确字段校验**；
 * children 引用完整递归联合 pptElementSchemaT，递归内错误定位到子元素位置）。
 * 与 pptElementSchemaT 的递归分支结构一致，两套 schema 独立构建、互不干扰。
 */
export const pptElementVariants: Record<string, TSchema> = {
  text: buildTextNode(pptElementSchemaT),
  vstack: buildStackNode('vstack', pptElementSchemaT),
  hstack: buildStackNode('hstack', pptElementSchemaT),
  icon: buildIconNode(pptElementSchemaT),
  shape: buildShapeNode(pptElementSchemaT),
  image: buildImageNode(pptElementSchemaT),
  ul: buildListNode('ul', pptElementSchemaT),
  ol: buildListNode('ol', pptElementSchemaT),
  layer: buildLayerNode(pptElementSchemaT),
  line: buildLineNode(pptElementSchemaT),
  arrow: buildArrowNode(pptElementSchemaT),
  table: buildTableNode(pptElementSchemaT),
  chart: buildChartNode(pptElementSchemaT),
  timeline: buildTimelineNode(pptElementSchemaT),
  flow: buildFlowNode(pptElementSchemaT),
  tree: buildTreeNode(pptElementSchemaT),
  matrix: buildMatrixNode(pptElementSchemaT),
  pyramid: buildPyramidNode(pptElementSchemaT),
  processArrow: buildProcessArrowNode(pptElementSchemaT),
  svg: buildSvgNode(pptElementSchemaT)
}
