/**
 * PPT 基本节点元素 schema（TypeBox）——与 pptComplexElementSchemas（复杂节点）共同组成
 * pptElementSchemaT 递归联合（单一数据源，校验与模型参数描述共用）。
 * 元素结构统一为 SlideNode：{ tag, attr, child }（tag 即 XML 标签名；attr 对象属性用点表示法；
 * child 为文本字符串或子元素数组）。公共属性见 pptCommonSchemas.ts；校验见 pptSchemas.ts。
 */
import { Type } from '@sinclair/typebox'
import type { TSchema } from '@sinclair/typebox'
import {
  childUnion,
  commonAttrs,
  glowAttrs,
  nodeIdProp,
  outlineAttrs,
  textAttrs
} from './pptCommonSchemas'
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

export const buildTextNode = (Self: unknown) =>
  Type.Object(
    {
      ...nodeIdProp,
      tag: Type.Literal('Text'),
      attr: Type.Object(
        {
          textGradient: Type.Optional(Type.String({ description: '文本渐变填充，优先于 color' })),
          ...glowAttrs,
          ...outlineAttrs,
          ...textAttrs,
          ...commonAttrs
        },
        { additionalProperties: false }
      ),
      child: childUnion(Self)
    },
    {
      additionalProperties: false,
      description:
        'Text 文本节点（默认字号 24、行距 1.3、字体 Noto Sans JP；文本写在 child 字符串）'
    }
  )

export const buildStackNode = (type: 'VStack' | 'HStack', Self: unknown) =>
  Type.Object(
    {
      ...nodeIdProp,
      tag: Type.Literal(type),
      attr: Type.Object(
        {
          gap: Type.Optional(Type.Number({ description: '子元素间距' })),
          alignItems: Type.Optional(
            Type.Union(
              [
                Type.Literal('start'),
                Type.Literal('center'),
                Type.Literal('end'),
                Type.Literal('stretch')
              ],
              {
                description: '交叉轴对齐（默认 stretch）'
              }
            )
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
            Type.Union(
              [Type.Literal('nowrap'), Type.Literal('wrap'), Type.Literal('wrapReverse')],
              {
                description: '换行（默认 nowrap）'
              }
            )
          ),
          ...commonAttrs
        },
        { additionalProperties: false }
      ),
      child: childUnion(Self)
    },
    {
      additionalProperties: false,
      description: `${type === 'VStack' ? 'VStack 纵向布局容器' : 'HStack 横向布局容器'}（flexbox，页面根元素必选其一）`
    }
  )

export const buildIconNode = (_Self: unknown) =>
  Type.Object(
    {
      ...nodeIdProp,
      tag: Type.Literal('Icon'),
      attr: Type.Object(
        {
          name: Type.String({
            description: 'lucide 图标名，如 rocket / check-circle / trending-up'
          }),
          size: Type.Optional(Type.Number({ description: '图标尺寸（默认 24）' })),
          color: Type.Optional(Type.String({ description: '图标色（默认 #000000）' })),
          variant: Type.Optional(
            Type.Union(
              [
                Type.Literal('circle-filled'),
                Type.Literal('circle-outlined'),
                Type.Literal('square-filled'),
                Type.Literal('square-outlined')
              ],
              { description: '带底色变体' }
            )
          ),
          bgColor: Type.Optional(Type.String({ description: '变体底色（默认 #E0E0E0）' })),
          ...commonAttrs
        },
        { additionalProperties: false }
      )
    },
    { additionalProperties: false, description: 'Icon 图标节点（lucide 内置库）' }
  )

export const buildShapeNode = (Self: unknown) =>
  Type.Object(
    {
      ...nodeIdProp,
      tag: Type.Literal('Shape'),
      attr: Type.Object(
        {
          shapeType: Type.String({
            description: '形状类型：roundRect / ellipse / triangle / diamond / star / heart 等'
          }),
          'fill.color': Type.Optional(Type.String({ description: '填充色' })),
          'fill.transparency': Type.Optional(
            Type.Number({ minimum: 0, maximum: 1, description: '透明度 0-1（0 不透明）' })
          ),
          'line.color': Type.Optional(Type.String({ description: '描边色' })),
          'line.width': Type.Optional(Type.Number({ description: '描边宽' })),
          'line.dashType': Type.Optional(Type.String({ description: '描边虚线样式' })),
          ...glowAttrs,
          ...textAttrs,
          ...commonAttrs
        },
        { additionalProperties: false }
      ),
      child: childUnion(Self)
    },
    { additionalProperties: false, description: 'Shape 形状节点（文本写在 child）' }
  )

export const buildImageNode = (_Self: unknown) =>
  Type.Object(
    {
      ...nodeIdProp,
      tag: Type.Literal('Image'),
      attr: Type.Object(
        {
          src: Type.String({ description: '图片：base64 data URI 或本地绝对路径（禁止 http）' }),
          'sizing.type': Type.Optional(
            Type.Union([Type.Literal('contain'), Type.Literal('cover'), Type.Literal('crop')], {
              description: 'contain / cover / crop（crop 需 x/y/w/h 像素）'
            })
          ),
          'sizing.x': Type.Optional(Type.Number()),
          'sizing.y': Type.Optional(Type.Number()),
          'sizing.w': Type.Optional(Type.Number()),
          'sizing.h': Type.Optional(Type.Number()),
          ...commonAttrs
        },
        { additionalProperties: false }
      )
    },
    { additionalProperties: false, description: 'Image 图片节点' }
  )

/** 列表项（Li）：文本写在 child，样式属性在 attr（顶层 id 不进 attr、不参与 POM，可安全携带） */
const liNode = (Self: unknown) =>
  Type.Object(
    {
      ...nodeIdProp,
      tag: Type.Literal('Li'),
      attr: Type.Object({ ...textAttrs }, { additionalProperties: false }),
      child: childUnion(Self)
    },
    { additionalProperties: false, description: '列表项（Li）' }
  )

export const buildListNode = (type: 'Ul' | 'Ol', Self: unknown) =>
  Type.Object(
    {
      ...nodeIdProp,
      tag: Type.Literal(type),
      attr: Type.Object(
        {
          ...(type === 'Ol'
            ? {
                numberType: Type.Optional(
                  Type.String({
                    description: '编号样式：arabicPlain / arabicPeriod / romanLcPeriod 等'
                  })
                ),
                numberStartAt: Type.Optional(Type.Number({ description: '起始编号（默认 1）' }))
              }
            : {}),
          ...textAttrs,
          ...commonAttrs
        },
        { additionalProperties: false }
      ),
      child: Type.Optional(
        Type.Array(liNode(Self), { description: '列表项（Li），文本写在 Li 的 child' })
      )
    },
    {
      additionalProperties: false,
      description: `${type === 'Ul' ? '无序' : '有序'}列表节点（Li 子项）`
    }
  )

export const buildLayerNode = (Self: unknown) =>
  Type.Object(
    {
      ...nodeIdProp,
      tag: Type.Literal('Layer'),
      attr: Type.Object({ ...commonAttrs }, { additionalProperties: false }),
      child: Type.Optional(
        Type.Array(Self as never, { description: '子元素（绝对定位，坐标相对 Layer 左上角）' })
      )
    },
    {
      additionalProperties: false,
      description: 'Layer 绝对定位容器（子元素用 position="absolute" + top/left 定位）'
    }
  )

export const buildLineNode = (_Self: unknown) =>
  Type.Object(
    {
      ...nodeIdProp,
      tag: Type.Literal('Line'),
      attr: Type.Object(
        {
          x1: Type.Number(),
          y1: Type.Number(),
          x2: Type.Number(),
          y2: Type.Number(),
          color: Type.Optional(Type.String({ description: '线条色（默认 000000）' })),
          lineWidth: Type.Optional(Type.Number({ description: '线宽（默认 1）' })),
          dashType: Type.Optional(Type.String()),
          beginArrow: Type.Optional(
            Type.Union([Type.Boolean(), Type.String()], {
              description: '起点箭头（true / 类型名）'
            })
          ),
          'beginArrow.type': Type.Optional(Type.String()),
          endArrow: Type.Optional(
            Type.Union([Type.Boolean(), Type.String()], {
              description: '终点箭头（true / 类型名）'
            })
          ),
          'endArrow.type': Type.Optional(Type.String()),
          ...commonAttrs
        },
        { additionalProperties: false }
      )
    },
    { additionalProperties: false, description: 'Line 线条节点（绝对坐标，不参与布局）' }
  )

export const buildArrowNode = (_Self: unknown) =>
  Type.Object(
    {
      ...nodeIdProp,
      tag: Type.Literal('Arrow'),
      attr: Type.Object(
        {
          from: Type.String({ description: '起点节点 id（Text 或 rect/roundRect/ellipse Shape）' }),
          to: Type.String({ description: '终点节点 id' }),
          color: Type.Optional(Type.String()),
          lineWidth: Type.Optional(Type.Number()),
          dashType: Type.Optional(Type.String()),
          beginArrow: Type.Optional(
            Type.Union([Type.Boolean(), Type.String()], {
              description: '起点箭头（true / 类型名）'
            })
          ),
          'beginArrow.type': Type.Optional(Type.String()),
          endArrow: Type.Optional(
            Type.Union([Type.Boolean(), Type.String()], {
              description: '终点箭头（true / 类型名）'
            })
          ),
          'endArrow.type': Type.Optional(Type.String()),
          ...commonAttrs
        },
        { additionalProperties: false }
      )
    },
    { additionalProperties: false, description: 'Arrow 连接箭头节点（from/to 引用节点 id）' }
  )

// ── 元素 schema（递归联合，单一数据源） ─────────────────────

export const pptElementSchemaT = Type.Recursive(
  (Self) =>
    Type.Union(
      [
        buildTextNode(Self),
        buildStackNode('VStack', Self),
        buildStackNode('HStack', Self),
        buildIconNode(Self),
        buildShapeNode(Self),
        buildImageNode(Self),
        buildListNode('Ul', Self),
        buildListNode('Ol', Self),
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
      { description: 'POM 幻灯片元素（SlideNode：tag + attr + child，tag 区分类型）' }
    ),
  { $id: 'PptElement' }
)

/** 页面元素数组 schema（1..N 个元素） */
export const pptElementsSchemaT = Type.Array(pptElementSchemaT, {
  minItems: 1,
  description:
    '页面元素数组（每个元素是 SlideNode：{tag, attr, child}；页面根元素必须是 VStack / HStack 布局容器）'
})

/**
 * 判别表：元素 tag → 对应分支 schema（顶层元素按 tag 判别做**精确字段校验**；
 * child 引用完整递归联合 pptElementSchemaT，递归内错误定位到子元素位置）。
 * 与 pptElementSchemaT 的递归分支结构一致，两套 schema 独立构建、互不干扰。
 */
export const pptElementVariants: Record<string, TSchema> = {
  Text: buildTextNode(pptElementSchemaT),
  VStack: buildStackNode('VStack', pptElementSchemaT),
  HStack: buildStackNode('HStack', pptElementSchemaT),
  Icon: buildIconNode(pptElementSchemaT),
  Shape: buildShapeNode(pptElementSchemaT),
  Image: buildImageNode(pptElementSchemaT),
  Ul: buildListNode('Ul', pptElementSchemaT),
  Ol: buildListNode('Ol', pptElementSchemaT),
  Layer: buildLayerNode(pptElementSchemaT),
  Line: buildLineNode(pptElementSchemaT),
  Arrow: buildArrowNode(pptElementSchemaT),
  Table: buildTableNode(pptElementSchemaT),
  Chart: buildChartNode(pptElementSchemaT),
  Timeline: buildTimelineNode(pptElementSchemaT),
  Flow: buildFlowNode(pptElementSchemaT),
  Tree: buildTreeNode(pptElementSchemaT),
  Matrix: buildMatrixNode(pptElementSchemaT),
  Pyramid: buildPyramidNode(pptElementSchemaT),
  ProcessArrow: buildProcessArrowNode(pptElementSchemaT),
  Svg: buildSvgNode(pptElementSchemaT)
}
