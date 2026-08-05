/**
 * 画布数据类型（.canvas 文件即此结构的 JSON 序列化）。
 *
 * v2 模型：图层树（Layer Tree）+ 调色板 palette，面向平面设计作品
 * （海报 / 封面 / 配图等）。children 顺序即图层 z 序（后画者在上）。
 * 定位以自由坐标为主；group 可开启可选自动布局（layout 缺省 none）。
 */

// ── 节点 ──────────────────────────────────────────────────

export type CanvasNodeType =
  | 'group' // 容器图层：组织子节点；layout 缺省 none 时自由定位，也可开启自动布局
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'polygon'
  | 'star'
  | 'path'
  | 'text'
  | 'image'
  | 'svg'

/** 布局组内尺寸关键字（仅 group 且 layout 非 none 时可用） */
export type CanvasLayoutSize = 'fill_container' | 'hug_contents'

/** 渐变起止点：方位名（如 'top-left' / 'bottom-right' / 'center'）或 {x,y} 坐标 */
export type CanvasPointRef = string | { x: number; y: number }

/** 渐变色标：纯色字符串自动均分 offset，或带 offset 的显式色标 */
export type CanvasGradientStop = string | { offset: number; color: string }

/** 渐变画笔（对应 Leafer 的 linear / radial / angular 渐变对象，可设给 fill 或 stroke） */
export interface CanvasGradientPaint {
  /** linear 线性 / radial 径向光晕 / angular 角度色环 */
  type: 'linear' | 'radial' | 'angular'
  from?: CanvasPointRef
  to?: CanvasPointRef
  /** 以 from 为中心继续旋转的角度（0~360，仅 angular） */
  rotation?: number
  /** 垂直于 from->to 的拉伸比例（radial / angular，默认 1） */
  stretch?: number
  /** 渐变色标数组，至少两个 */
  stops: CanvasGradientStop[]
  opacity?: number
  blendMode?: string
}

/** 填充 / 描边画笔：纯色字符串（支持 $name 调色板引用）、颜色名或渐变对象 */
export type CanvasPaint = string | CanvasGradientPaint

/** 描边样式枚举（对应 Leafer StrokeCap / StrokeJoin / StrokeAlign） */
export type CanvasStrokeCap = 'none' | 'round' | 'square'
export type CanvasStrokeJoin = 'miter' | 'bevel' | 'round'
export type CanvasStrokeAlign = 'inside' | 'center' | 'outside'

/** 效果：阴影 / 模糊，数组可叠加多层阴影营造立体感 */
export interface CanvasEffect {
  /** drop-shadow 外阴影 / inner-shadow 内阴影 / layer-blur 高斯模糊 / background-blur 背景模糊 */
  type: 'drop-shadow' | 'inner-shadow' | 'layer-blur' | 'background-blur'
  /** 阴影偏移 */
  x?: number
  y?: number
  /** 模糊半径 */
  radius?: number
  /** 阴影扩散（仅 drop-shadow） */
  spread?: number
  /** 阴影颜色，支持 rgba() */
  color?: string
  visible?: boolean
}

export type CanvasTextAlign = 'left' | 'center' | 'right'
export type CanvasTextCase = 'none' | 'upper' | 'lower'
export type CanvasFontWeight =
  | number
  | '100'
  | '200'
  | '300'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900'

/** 画布中的单个图层节点 */
export interface CanvasNode {
  id: string
  type: CanvasNodeType
  /** 图层名：创建时必填且有意义（便于辨识与后续引用） */
  name?: string
  // ── 定位与几何（自由定位为主） ──
  x?: number
  y?: number
  /** 精确像素；布局组内可为 fill_container / hug_contents */
  width?: number | CanvasLayoutSize
  height?: number | CanvasLayoutSize
  rotation?: number
  opacity?: number
  visible?: boolean
  blendMode?: string
  /** 布局父内的定位方式：AUTO 参与布局 / ABSOLUTE 绝对定位 */
  layoutPositioning?: 'AUTO' | 'ABSOLUTE'
  // ── 自动布局（仅 group；layout 缺省 'none' 自由定位） ──
  layout?: 'none' | 'horizontal' | 'vertical' | 'wrap'
  gap?: number
  padding?: number | number[]
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN' | 'SPACE_EVENLY'
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE'
  layoutGrow?: number
  // ── 填充 / 描边 / 质感 ──
  /** 填充：纯色 / 渐变对象 / $name 调色板引用 */
  fill?: CanvasPaint
  stroke?: CanvasPaint
  strokeWidth?: number
  strokeCap?: CanvasStrokeCap
  strokeJoin?: CanvasStrokeJoin
  strokeAlign?: CanvasStrokeAlign
  dashPattern?: number[]
  /** 圆角半径，数组表示 [左上,右上,右下,左下] */
  cornerRadius?: number | number[]
  /** 效果数组（阴影 / 模糊），可叠加 */
  effects?: CanvasEffect[]
  // ── 文本（type: 'text'） ──
  text?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: CanvasFontWeight
  italic?: boolean
  letterSpacing?: number
  lineHeight?: number | 'AUTO'
  textAlign?: CanvasTextAlign
  textCase?: CanvasTextCase
  // ── 折线 / 多边形 / 星形 ──
  /** 折线顶点扁平坐标 [x1,y1,x2,y2,...] */
  points?: number[]
  /** 正多边形边数（≥3） */
  sides?: number
  /** 星形角数（≥3） */
  corners?: number
  /** 星形内半径比例（0~1，默认 0.382） */
  innerRadius?: number
  /** 起始角度偏移（度，-180~180） */
  startAngle?: number
  // ── 路径 ──
  /** SVG 路径数据，如 M10 20 L60 20 L60 60 Z */
  path?: string
  // ── 图片 / SVG ──
  /** 图片地址（file:// / http(s) / data URL） */
  imageUrl?: string
  /** 内联 SVG 字符串（与 imageUrl 二选一） */
  svg?: string
  // ── 占位图标签（G 操作 placeholder 生成，渲染层居中绘制） ──
  placeholderLabel?: string
  // ── 子节点（children 顺序即 z 序） ──
  children?: CanvasNode[]
}

/** 批量插入节点入参：CanvasNode 去掉 id（id 由系统自动生成） */
export type CanvasNodeInput = Omit<CanvasNode, 'id'>

// ── 批量编辑操作（对齐 ardot batch_edit 的 I/C/U/M/D/G） ──

export type CanvasImageKind = 'placeholder' | 'stock' | 'ai'

export type CanvasBatchOp =
  | {
      /** 插入（I）：向父节点新增一个节点 */
      op: 'insert'
      /** 绑定名：同批内后续 op 用 parent: '@绑定名' 引用本节点 */
      as?: string
      /** 父节点：'root' | 已存在 group id | '@绑定名' */
      parent: string
      node: CanvasNodeInput
    }
  | {
      /** 复制（C）：深拷贝指定节点（含子树，id 重新生成）并挂到新父节点 */
      op: 'copy'
      as?: string
      /** 被复制节点 id */
      id: string
      parent: string
      /** 覆盖复制根节点自身属性（不含子节点） */
      overrides?: Record<string, unknown>
    }
  | {
      /** 更新（U）：按路径更新节点属性；禁改 id / type / children */
      op: 'update'
      /** 节点路径：'id' 或 '父id;子id'（可多层）或 '@绑定;子id' */
      path: string
      patch: Record<string, unknown>
    }
  | {
      /** 移动（M）：移动节点到新父节点（或同父内重排） */
      op: 'move'
      id: string
      /** 新父节点：省略则仅在同父内调整 index */
      parent?: string
      /** 兄弟节点中的位置索引，省略放末尾 */
      index?: number
    }
  | {
      /** 删除（D）：删除指定节点（含子树） */
      op: 'delete'
      id: string
    }
  | {
      /** 图片（G）：为目标节点生成图片（占位 / 网络占位图） */
      op: 'image'
      /** 目标节点 id */
      id: string
      /** placeholder 渐变占位 / stock 网络占位图（picsum，稳定种子） / ai 暂按 stock 兜底 */
      kind: CanvasImageKind
      /** placeholder: 短标签（≤20 字）；stock/ai: 种子或描述 */
      prompt?: string
    }

// ── 文档 ──────────────────────────────────────────────────

/** 画布文档：schema 2 = 图层树模型（旧扁平 shapes 模型不再兼容） */
export interface CanvasDoc {
  /** 文件名（不含扩展名），固定 canvas-{version} */
  name: string
  /** 画布文件版本号，写入文件名后缀 canvas-{version} */
  version: number
  /** 画布展示标题（可选，便于 t-select 辨识） */
  title?: string
  /** 数据模型版本：固定 2 */
  schema: 2
  width: number
  height: number
  background: string
  /** 根图层（children 顺序即 z 序） */
  nodes: CanvasNode[]
  /** 调色板：name → 颜色，字段可用 $name 引用，保证全页色彩和谐 */
  palette: Record<string, string>
}

/** 画布文件列表项（供 t-select 选择不同画布） */
export interface CanvasFileInfo {
  name: string
  version: number
  title?: string
  path: string
  updatedTime: number
}

/** 画布工具运行所需上下文（sandboxDir 需实时读取，支持切换后仍生效） */
export interface CanvasToolContext {
  /** 读取当前沙盒目录（用于定位 outputs/ 下的 .canvas 文件） */
  getSandboxDir: () => string
}
