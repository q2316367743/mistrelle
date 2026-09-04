import { Type } from '@sinclair/typebox'
import { collectErrors, toToolProperty } from '@/windows/main/modules/tool/typeboxUtil'
import type { ToolProperty } from '@/domain'
import { CANVAS_ALIGNS } from './canvasTypes'

/**
 * 画布节点 / 批量操作 schema —— TypeBox 单一源：
 * - 运行时校验（CanvasStore 入参拦截）与喂给模型的参数描述（canvasTools）
 *   共用同一套 schema，保证「文档（模型看到的结构）与执行类型一致」。
 * - 字段类型严格（number 不再标注为 string），枚举用 Literal 联合，
 *   additionalProperties: false 拒绝未知字段，非法即报错反馈模型自纠。
 */

// ── 基础子 schema ──────────────────────────────────────────

const pointRefSchema = Type.Union(
  [
    Type.Literal('top-left'),
    Type.Literal('top'),
    Type.Literal('top-right'),
    Type.Literal('right'),
    Type.Literal('bottom-right'),
    Type.Literal('bottom'),
    Type.Literal('bottom-left'),
    Type.Literal('left'),
    Type.Literal('center'),
    Type.Object({ x: Type.Number(), y: Type.Number() }, { additionalProperties: false })
  ],
  {
    description: `渐变起止点：方位名（仅 ${CANVAS_ALIGNS.join(' / ')}）或 {x,y}。垂直渐变用 top→bottom，禁止 top-center / bottom-center`
  }
)

const gradientStopSchema = Type.Union([
  Type.String({ description: '纯色，自动均分 offset' }),
  Type.Object(
    { offset: Type.Number(), color: Type.String() },
    { additionalProperties: false }
  )
])

const gradientPaintSchema = Type.Object(
  {
    type: Type.Union(
      [Type.Literal('linear'), Type.Literal('radial'), Type.Literal('angular')],
      { description: 'linear 线性 / radial 径向光晕 / angular 角度色环' }
    ),
    from: Type.Optional(pointRefSchema),
    to: Type.Optional(pointRefSchema),
    rotation: Type.Optional(Type.Number({ description: '以 from 为中心继续旋转的角度（0~360）' })),
    stretch: Type.Optional(Type.Number({ description: '垂直于 from->to 的拉伸比例' })),
    stops: Type.Array(gradientStopSchema, { minItems: 2, description: '渐变色标数组，至少两个' }),
    opacity: Type.Optional(Type.Number()),
    blendMode: Type.Optional(Type.String())
  },
  { additionalProperties: false }
)

const paintSchema = Type.Union([
  Type.String({ description: '纯色（#RRGGBB / rgba() / 颜色名 / $调色板token名），"none" 表示无填充' }),
  gradientPaintSchema
])

const effectSchema = Type.Object(
  {
    type: Type.Union(
      [
        Type.Literal('drop-shadow'),
        Type.Literal('inner-shadow'),
        Type.Literal('layer-blur'),
        Type.Literal('background-blur')
      ],
      { description: 'drop-shadow 外阴影 / inner-shadow 内阴影 / layer-blur 高斯模糊 / background-blur 背景模糊' }
    ),
    x: Type.Optional(Type.Number({ description: '阴影偏移 x' })),
    y: Type.Optional(Type.Number({ description: '阴影偏移 y' })),
    radius: Type.Optional(Type.Number({ description: '模糊半径' })),
    spread: Type.Optional(Type.Number({ description: '阴影扩散（仅 drop-shadow）' })),
    color: Type.Optional(Type.String({ description: '阴影颜色，支持 rgba()' })),
    visible: Type.Optional(Type.Boolean())
  },
  { additionalProperties: false }
)

const layoutSizeSchema = Type.Union([
  Type.Number(),
  Type.Literal('fill_container', { description: '撑满父容器' }),
  Type.Literal('hug_contents', { description: '包裹内容' })
])

// ── 动画 schema（additionalProperties: true 放行任意样式键，仅约束选项结构） ──

const animationStyleSchema = Type.Object(
  {},
  {
    additionalProperties: true,
    description:
      '目标样式（style）或关键帧样式：任意渲染属性，如 x / y / rotation / opacity / fill / cornerRadius / scaleX / scaleY'
  }
)

const animationSchema = Type.Object(
  {
    style: Type.Optional(animationStyleSchema),
    keyframes: Type.Optional(
      Type.Array(
        Type.Object(
          {
            style: Type.Optional(animationStyleSchema),
            duration: Type.Optional(Type.Number({ description: '本关键帧固定时长（秒）' })),
            delay: Type.Optional(Type.Number({ description: '本关键帧延迟（秒）' })),
            easing: Type.Optional(Type.String({ description: '本关键帧缓动方式' }))
          },
          { additionalProperties: true }
        ),
        { description: '关键帧动画（优先于 style）' }
      )
    ),
    duration: Type.Optional(Type.Number({ description: '总时长（秒），默认 0.2' })),
    delay: Type.Optional(Type.Number({ description: '延迟（秒），默认 0' })),
    easing: Type.Optional(Type.String({ description: "缓动方式：'ease' / 'linear' / 'bounce-out' 等" })),
    loop: Type.Optional(
      Type.Union([Type.Boolean(), Type.Number()], { description: '循环播放：true 无限 / 数字次数' })
    ),
    swing: Type.Optional(
      Type.Union([Type.Boolean(), Type.Number()], { description: '摇摆（往返）循环：到达 to 的次数' })
    ),
    reverse: Type.Optional(Type.Boolean({ description: '反向动画 to -> from' })),
    speed: Type.Optional(Type.Number({ description: '播放倍速，越大越快' })),
    join: Type.Optional(Type.Boolean({ description: '加入动画前元素状态作为 from 关键帧' })),
    autoplay: Type.Optional(Type.Boolean({ description: '是否自动播放（预览默认 true）' }))
  },
  {
    additionalProperties: true,
    description:
      '节点动画：style 过渡或 keyframes 关键帧 + 动画选项（duration/delay/easing/loop/swing/reverse/speed/join/autoplay）'
  }
)

// ── 节点字段（nodeSchema 与 nodePatchSchema 共用） ──────────

const nodeFieldSchema = {
  name: Type.Optional(Type.String({ description: '图层名，必填且有意义' })),
  x: Type.Optional(Type.Number({ description: 'x 坐标（画布原点在左上角，向右为正）' })),
  y: Type.Optional(Type.Number({ description: 'y 坐标（画布原点在左上角，向下为正）' })),
  width: Type.Optional(layoutSizeSchema),
  height: Type.Optional(layoutSizeSchema),
  rotation: Type.Optional(Type.Number({ description: '旋转角度（度，顺时针）' })),
  opacity: Type.Optional(Type.Number({ minimum: 0, maximum: 1, description: '不透明度 0-1' })),
  visible: Type.Optional(Type.Boolean({ description: '是否可见（默认 true）' })),
  blendMode: Type.Optional(Type.String({ description: '混合模式：normal / multiply / screen / overlay 等' })),
  layoutPositioning: Type.Optional(
    Type.Union([Type.Literal('AUTO'), Type.Literal('ABSOLUTE')], {
      description: '布局父内的定位方式：AUTO 参与布局（默认）/ ABSOLUTE 绝对定位（用自身 x/y）'
    })
  ),
  layout: Type.Optional(
    Type.Union(
      [Type.Literal('none'), Type.Literal('horizontal'), Type.Literal('vertical'), Type.Literal('wrap')],
      { description: 'group 的自动布局（缺省 none 自由定位）' }
    )
  ),
  gap: Type.Optional(Type.Number({ description: '自动布局子节点间距' })),
  padding: Type.Optional(
    Type.Union(
      [Type.Number(), Type.Array(Type.Number())],
      { description: '内边距：数值，或 [水平,垂直]，或 [上,右,下,左]' }
    )
  ),
  primaryAxisAlignItems: Type.Optional(
    Type.Union(
      [
        Type.Literal('MIN'),
        Type.Literal('START'),
        Type.Literal('CENTER'),
        Type.Literal('MAX'),
        Type.Literal('END'),
        Type.Literal('SPACE_BETWEEN'),
        Type.Literal('SPACE_EVENLY')
      ],
      {
        description:
          '布局组主轴对齐：MIN/START 靠起点、CENTER、MAX/END 靠终点、SPACE_BETWEEN、SPACE_EVENLY（START≡MIN、END≡MAX）'
      }
    )
  ),
  counterAxisAlignItems: Type.Optional(
    Type.Union(
      [
        Type.Literal('MIN'),
        Type.Literal('START'),
        Type.Literal('CENTER'),
        Type.Literal('MAX'),
        Type.Literal('END'),
        Type.Literal('BASELINE')
      ],
      {
        description:
          '布局组交叉轴对齐：MIN/START 靠起点、CENTER、MAX/END 靠终点、BASELINE（START≡MIN、END≡MAX；BASELINE 暂等同 MIN）'
      }
    )
  ),
  layoutGrow: Type.Optional(Type.Number({ description: '布局组内伸展权重' })),
  fill: Type.Optional(paintSchema),
  stroke: Type.Optional(paintSchema),
  strokeWidth: Type.Optional(Type.Number({ description: '描边宽度' })),
  strokeCap: Type.Optional(Type.Union([Type.Literal('none'), Type.Literal('round'), Type.Literal('square')], { description: '描边端点' })),
  strokeJoin: Type.Optional(Type.Union([Type.Literal('miter'), Type.Literal('bevel'), Type.Literal('round')], { description: '描边连接' })),
  strokeAlign: Type.Optional(Type.Union([Type.Literal('inside'), Type.Literal('center'), Type.Literal('outside')], { description: '描边对齐' })),
  dashPattern: Type.Optional(Type.Array(Type.Number(), { description: '虚线描边：[线段长度, 间隙]' })),
  cornerRadius: Type.Optional(Type.Union([Type.Number(), Type.Array(Type.Number())], { description: '圆角半径（注意不是 borderRadius）' })),
  effects: Type.Optional(Type.Array(effectSchema, { description: '效果数组（阴影 / 模糊）' })),
  text: Type.Optional(Type.String({ description: '文本内容（text 节点）' })),
  fontSize: Type.Optional(Type.Number({ description: '字号' })),
  fontFamily: Type.Optional(Type.String({ description: '字体族' })),
  fontWeight: Type.Optional(
    Type.Union(
      [Type.Number(), Type.Literal('100'), Type.Literal('200'), Type.Literal('300'), Type.Literal('400'), Type.Literal('500'), Type.Literal('600'), Type.Literal('700'), Type.Literal('800'), Type.Literal('900')],
      { description: '字重：数字（400/700/900）或字符串 "400"~"900"' }
    )
  ),
  italic: Type.Optional(Type.Boolean({ description: '斜体' })),
  letterSpacing: Type.Optional(Type.Number({ description: '字间距' })),
  lineHeight: Type.Optional(Type.Union([Type.Number(), Type.Literal('AUTO')], { description: '行高：数值或 AUTO' })),
  textAlign: Type.Optional(Type.Union([Type.Literal('left'), Type.Literal('center'), Type.Literal('right')], { description: '文本对齐' })),
  textCase: Type.Optional(Type.Union([Type.Literal('none'), Type.Literal('upper'), Type.Literal('lower')], { description: '大小写' })),
  points: Type.Optional(Type.Array(Type.Number(), { description: '折线顶点扁平坐标 [x1,y1,x2,y2,...]' })),
  sides: Type.Optional(Type.Number({ minimum: 3, description: '正多边形边数（≥3）' })),
  corners: Type.Optional(Type.Number({ minimum: 3, description: '星形角数（≥3）' })),
  innerRadius: Type.Optional(Type.Number({ minimum: 0, maximum: 1, description: '星形内半径比例（0~1）' })),
  startAngle: Type.Optional(Type.Number({ description: '起始角度偏移（度，-180~180）' })),
  path: Type.Optional(Type.String({ description: 'SVG 路径数据，如 M10 20 L60 20 L60 60 Z' })),
  imageUrl: Type.Optional(Type.String({ description: '图片地址（本地绝对路径 / file:// / http(s) / data URL）' })),
  svg: Type.Optional(Type.String({ description: '内联 SVG 字符串（与 imageUrl 二选一）' })),
  placeholderLabel: Type.Optional(Type.String({ description: '占位图标签' })),
  animation: Type.Optional(animationSchema),
  animationOut: Type.Optional(animationSchema)
}

// ── 节点 schema（递归，含 children） ───────────────────────

export const nodeSchemaT = Type.Recursive(
  (Self) =>
    Type.Object(
      {
        type: Type.Optional(
          Type.Union(
            [
              Type.Literal('group'),
              Type.Literal('text'),
              Type.Literal('rect'),
              Type.Literal('ellipse'),
              Type.Literal('line'),
              Type.Literal('polygon'),
              Type.Literal('star'),
              Type.Literal('path'),
              Type.Literal('image'),
              Type.Literal('svg')
            ],
            { description: '节点类型（可省略，系统按字段推断）' }
          )
        ),
        ...nodeFieldSchema,
        children: Type.Optional(Type.Array(Self, { description: '子节点列表（children 顺序即 z 序，后画者在上）' }))
      },
      { additionalProperties: false, description: '图层节点数据。所有节点必须赋有意义的 name；children 顺序即 z 序' }
    ),
  { $id: 'CanvasNode' }
)

/** update patch / copy overrides：节点字段（禁改 id / type / children） */
export const nodePatchSchemaT = Type.Object(nodeFieldSchema, {
  additionalProperties: false,
  description: '要更新的节点字段（不能改 id / type / children）'
})

// ── 批量操作 schema（op 判别联合） ─────────────────────────

const insertOpSchema = Type.Object(
  {
    op: Type.Literal('insert'),
    as: Type.Optional(Type.String({ description: '绑定名：同批内后续 op 用 parent:"@绑定名" 引用' })),
    parent: Type.String({ description: '父节点："root" 或 group 的 id 或 "@绑定名"' }),
    node: nodeSchemaT
  },
  { additionalProperties: false }
)

const copyOpSchema = Type.Object(
  {
    op: Type.Literal('copy'),
    as: Type.Optional(Type.String({ description: '绑定名' })),
    id: Type.String({ description: '被复制节点 id' }),
    parent: Type.String({ description: '父节点："root" 或 group 的 id 或 "@绑定名"' }),
    overrides: Type.Optional(nodePatchSchemaT)
  },
  { additionalProperties: false }
)

const updateOpSchema = Type.Object(
  {
    op: Type.Literal('update'),
    path: Type.String({ description: '节点路径："id" 或 "父id;子id"（可多层）或 "@绑定名;子id"' }),
    patch: nodePatchSchemaT
  },
  { additionalProperties: false }
)

const moveOpSchema = Type.Object(
  {
    op: Type.Literal('move'),
    id: Type.String({ description: '被移动节点 id' }),
    parent: Type.Optional(Type.String({ description: '新父节点：省略则仅在同父内调整 index' })),
    index: Type.Optional(Type.Number({ description: '兄弟节点中的位置索引，省略放末尾' }))
  },
  { additionalProperties: false }
)

const deleteOpSchema = Type.Object(
  { op: Type.Literal('delete'), id: Type.String({ description: '目标节点 id' }) },
  { additionalProperties: false }
)

const imageOpSchema = Type.Object(
  {
    op: Type.Literal('image'),
    id: Type.String({ description: '目标节点 id' }),
    kind: Type.Union(
      [
        Type.Literal('placeholder'),
        Type.Literal('stock'),
        Type.Literal('ai'),
        Type.Literal('web'),
        Type.Literal('local')
      ],
      { description: 'placeholder 渐变占位 / stock 网络占位图 / ai 按 stock 兜底 / web 真实图片 URL（自动下载落盘沙盒）/ local 本地图片路径' }
    ),
    prompt: Type.Optional(Type.String({ description: 'placeholder: 短标签；stock/ai: 种子或描述；web/local: 备用描述' })),
    url: Type.Optional(Type.String({ description: 'local: 本地图片绝对路径；web: 真实图片 URL（http/https）' }))
  },
  { additionalProperties: false }
)

export const batchOpSchemaT = Type.Union(
  [insertOpSchema, copyOpSchema, updateOpSchema, moveOpSchema, deleteOpSchema, imageOpSchema],
  { description: '批量编辑操作' }
)

const opSchemaMap = {
  insert: insertOpSchema,
  copy: copyOpSchema,
  update: updateOpSchema,
  move: moveOpSchema,
  delete: deleteOpSchema,
  image: imageOpSchema
} as const

// ── 模型侧参数描述（ToolProperty）：由 TypeBox schema 转换，与运行时永一致 ──

/** 节点 schema（供模型了解图层模型 / insert 的 node 字段） */
export const nodeSchema: ToolProperty = toToolProperty(nodeSchemaT)

/** 批量编辑单条操作 schema（供 canvas_batch_edit 的 operations 数组元素） */
export const batchOpSchema: ToolProperty = toToolProperty(batchOpSchemaT)

// ── 运行时校验（中文错误信息，非法即报错反馈模型自纠） ──────

/** 校验批量操作（按 op 判别到具体子 schema，给出精确错误） */
export const validateBatchOp = (op: unknown): string[] => {
  if (!op || typeof op !== 'object' || Array.isArray(op)) return ['操作必须是 JSON 对象']
  const opName = (op as { op?: unknown }).op
  if (typeof opName !== 'string') return ['缺少 op 字段']
  const variant = opSchemaMap[opName as keyof typeof opSchemaMap]
  if (!variant) return [`op 必须是 insert / copy / update / move / delete / image 之一，收到 ${opName}`]
  return collectErrors(variant, op)
}

/** 校验节点（含 children 递归） */
export const validateNode = (value: unknown): string[] => collectErrors(nodeSchemaT, value)

/** 校验 update patch / copy overrides */
export const validatePatch = (value: unknown): string[] => collectErrors(nodePatchSchemaT, value)
