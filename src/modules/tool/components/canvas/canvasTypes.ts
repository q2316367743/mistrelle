/**
 * 画布数据类型（.canvas 文件即此结构的 JSON 序列化）。
 * 采用 leafer 兼容的字段命名，便于渲染层直接映射。
 */

export type CanvasShapeType =
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'text'
  | 'polygon'
  | 'star'
  | 'path'
  | 'image'
  | 'svg'

/** 渐变起止点：方位名（如 'top-left' / 'bottom-right' / 'center'）或 {x,y} 坐标 */
export type CanvasPointRef = string | { x: number; y: number }

/** 渐变色标：纯色字符串自动均分 offset，或带 offset 的显式色标 */
export type CanvasGradientStop = string | { offset: number; color: string }

/** 渐变画笔（对应 Leafer 的 linear / radial / angular 渐变对象，可设给 fill 或 stroke） */
export interface CanvasGradientPaint {
  /** linear 线性 / radial 径向 / angular 角度（同心色环） */
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

/** 填充 / 描边画笔：纯色字符串 或 渐变对象 */
export type CanvasPaint = string | CanvasGradientPaint

/** 阴影效果（对应 Leafer ShadowEffect，外阴影 / 内阴影共用） */
export interface CanvasShadow {
  x: number
  y: number
  blur: number
  /** 阴影扩散（仅外阴影支持） */
  spread?: number
  color: string
  /** true 时仅显示图形外部的阴影，同 CSS box-shadow */
  box?: boolean
}

/** 描边样式枚举（对应 Leafer StrokeCap / StrokeJoin / StrokeAlign） */
export type CanvasStrokeCap = 'none' | 'round' | 'square'
export type CanvasStrokeJoin = 'miter' | 'bevel' | 'round'
export type CanvasStrokeAlign = 'inside' | 'center' | 'outside'

/** 画布中的单个图形（含通用几何与样式字段） */
export interface CanvasShape {
  id: string
  type: CanvasShapeType
  // ── 几何 ──
  x: number
  y: number
  width?: number
  height?: number
  /** 旋转角度（度） */
  rotation?: number
  // ── 描边与填充 ──
  fill?: CanvasPaint
  stroke?: CanvasPaint
  strokeWidth?: number
  /** 描边端点形状 */
  strokeCap?: CanvasStrokeCap
  /** 描边拐角处理 */
  strokeJoin?: CanvasStrokeJoin
  /** 描边对齐方式（闭合图形默认 inside） */
  strokeAlign?: CanvasStrokeAlign
  /** 虚线描边 [线段, 间隙] */
  dashPattern?: number[]
  opacity?: number
  // ── 质感效果 ──
  /** 圆角半径，数组表示 [左上,右上,右下,左下] */
  cornerRadius?: number | number[]
  /** 外阴影，支持数组叠加 */
  shadow?: CanvasShadow | CanvasShadow[]
  /** 内阴影，支持数组叠加 */
  innerShadow?: CanvasShadow | CanvasShadow[]
  /** 混合模式，如 normal / multiply / screen / overlay */
  blendMode?: string
  /** 高斯模糊半径 */
  blur?: number
  /** 背景模糊半径（毛玻璃） */
  backgroundBlur?: number
  // ── 文本 ──
  text?: string
  fontSize?: number
  fontWeight?: number
  fontFamily?: string
  textColor?: CanvasPaint
  // ── 线条 ──
  points?: Array<number>
  // ── 多边形 / 星形 ──
  /** 正多边形边数（≥3） */
  sides?: number
  /** 星形角数（≥3） */
  corners?: number
  /** 星形内半径比例（0~1，默认 0.382） */
  innerRadius?: number
  /** 起始角度偏移（度，-180~180） */
  startAngle?: number
  // ── 路径 ──
  /** SVG 路径数据，如 M10 20 L60 20 ... */
  path?: string
  // ── 图片 / SVG ──
  /** 图片或 svg 文件地址（file:// / http(s) / data URL） */
  imageUrl?: string
  /** 内联 SVG 字符串（与 imageUrl 二选一） */
  svg?: string
}

/** 画布文档：一个 .canvas 文件对应一个 CanvasDoc */
export interface CanvasDoc {
  /** 文件名（不含扩展名），固定 canvas-{version} */
  name: string
  /** 画布文件版本号，写入文件名后缀 canvas-{version} */
  version: number
  /** 画布展示标题（可选，便于 t-select 辨识） */
  title?: string
  width: number
  height: number
  background: string
  shapes: CanvasShape[]
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

/** 新增图形的通用入参（typed 工具据此构造 CanvasShape） */
export interface CanvasShapeInput {
  x: number
  y: number
  width?: number
  height?: number
  rotation?: number
  fill?: CanvasPaint
  stroke?: CanvasPaint
  strokeWidth?: number
  strokeCap?: CanvasStrokeCap
  strokeJoin?: CanvasStrokeJoin
  strokeAlign?: CanvasStrokeAlign
  dashPattern?: number[]
  opacity?: number
  cornerRadius?: number | number[]
  shadow?: CanvasShadow | CanvasShadow[]
  innerShadow?: CanvasShadow | CanvasShadow[]
  blendMode?: string
  blur?: number
  backgroundBlur?: number
  text?: string
  fontSize?: number
  fontWeight?: number
  fontFamily?: string
  textColor?: CanvasPaint
  points?: Array<number>
  sides?: number
  corners?: number
  innerRadius?: number
  startAngle?: number
  path?: string
  imageUrl?: string
  svg?: string
}
