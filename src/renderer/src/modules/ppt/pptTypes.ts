/**
 * PPT 专家模块类型定义。
 * 文件存储：沙盒 outputs/{name}.ppt.json（单一文件持续编辑；一个文件含多个 Slide 页面）。
 * 全程 JSON（SlideNode）：渲染层（vueRender 组件）直接消费；导出走「DOM 快照 → 主进程
 * PptxGenJS 按绝对坐标摆放」（见 vueRender/snapshot.ts 与快照类型）。
 */

/**
 * SlideNode：通用节点（tag 即 vueRender 组件类型），child 为字符串表示文本内容
 * （如 Text 节点）。id 为节点唯一标识（**顶层字段，与 tag 并列**，自动生成）：
 * 不进 attr、不参与布局，服务节点点选引用与 ppt_batch_edit 的精准编辑。
 * 注意：与 preload 的 src/preload/src/modules/ppt/pptChannels.ts 形状一致（IPC 契约），修改需同步。
 */
export interface SlideNode {
  id?: string
  tag: string
  attr: Record<string, string>
  child: Array<SlideNode> | string
}

/**
 * PPT 文档 JSON（{name}.ppt.json 文件内容）：
 * slide 每项是一页的根节点数组（对应 <Slide> 内的多个子元素，POM 隐式 VStack 语义）。
 */
export interface PptJsonDoc {
  name: string
  /** 创建时间（Date.now() 毫秒） */
  createdAt: number
  /** 最近修改时间（Date.now() 毫秒） */
  updatedAt: number
  /** 主题令牌表：token 名 → 6 位 hex 颜色（渲染时引用为 $token） */
  theme: Record<string, string>
  slide: SlideNode[][]
}

/** outputs/ 下的 PPT 文件信息（refreshFiles 扫描产物，id = 文件名） */
export interface PptFileInfo {
  id: string
  name: string
  path: string
  updatedTime: number
}

/** 当前打开的 PPT 文档（current 状态） */
export interface PptCurrentDoc {
  id: string
  name: string
  /** 文档 JSON（渲染 / 编辑的数据源） */
  json: PptJsonDoc
}

/** 渲染尺寸：16:9 标准画布（与 ppt_guidelines 一致） */
export const PPT_SLIDE_SIZE = { w: 1280, h: 720 } as const

/** Theme 令牌表：token 名 → 6 位 hex 颜色 */
export type PptTheme = Record<string, string>

// ── 导出快照（预览 DOM 实测 → 主进程 PptxGenJS / PNG） ──────
// 坐标均为画布像素（原点 = 页左上角）；与 preload 的 src/preload/src/modules/ppt/pptChannels.ts 同步。

/** 快照项公共几何 */
export interface PptItemBase {
  x: number
  y: number
  w: number
  h: number
  /** 旋转（度，顺时针，绕中心） */
  rotate?: number
  /** 元素不透明度 0-1 */
  opacity?: number
  /** zIndex（导出前按其稳定排序决定 z 序） */
  zIndex?: number
  /** 来源节点 id（追踪调试用） */
  nodeId?: string
}

export interface PptShadowInput {
  type: 'outer' | 'inner'
  color: string
  opacity?: number
  blur?: number
  offset?: number
  angle?: number
}

export interface PptFillInput {
  color?: string
  /** CSS 渐变串（导出侧栅格化为图片） */
  gradient?: string
  transparency?: number
}

export interface PptStrokeInput {
  color: string
  width: number
  dashType?: string
}

export interface PptTextItem extends PptItemBase {
  kind: 'text'
  text: string
  fontSize: number
  color: string
  fontFamily: string
  bold: boolean
  italic: boolean
  strike: boolean
  underline: boolean
  align: 'left' | 'center' | 'right'
  valign: 'top' | 'middle'
  /** 精确行高（px，= 字号 × 行距倍率） */
  lineHeightPx: number
  letterSpacingPx?: number
  subscript?: boolean
  superscript?: boolean
}

export interface PptRectItem extends PptItemBase {
  kind: 'rect'
  fill?: PptFillInput
  radius?: number
  stroke?: PptStrokeInput
  shadow?: PptShadowInput
}

export interface PptEllipseItem extends PptItemBase {
  kind: 'ellipse'
  fill?: PptFillInput
  stroke?: PptStrokeInput
  shadow?: PptShadowInput
}

export interface PptShapeItem extends PptItemBase {
  kind: 'shape'
  /** 预设形状名（映射 PptxGenJS ShapeType；未知回退 rect） */
  shapeType: string
  fill?: PptFillInput
  stroke?: PptStrokeInput
  shadow?: PptShadowInput
}

export interface PptImageItem extends PptItemBase {
  kind: 'image'
  /** data URI 或沙盒本地路径（主进程读盘） */
  src: string
  sizing?: 'contain' | 'cover'
}

export interface PptLineItem extends PptItemBase {
  kind: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  width: number
  dashType?: string
  beginArrow?: string
  endArrow?: string
  nodeId?: string
}

export interface PptChartSeries {
  name: string
  labels: string[]
  values: number[]
}

export interface PptChartItem extends PptItemBase {
  kind: 'chart'
  chartType: 'bar' | 'line' | 'pie' | 'area' | 'doughnut' | 'radar'
  data: PptChartSeries[]
  chartColors?: string[]
  title?: string
  showTitle?: boolean
  showLegend?: boolean
  sparkline?: boolean
  radarStyle?: string
}

export type PptExportItem =
  | PptTextItem
  | PptRectItem
  | PptEllipseItem
  | PptShapeItem
  | PptImageItem
  | PptLineItem
  | PptChartItem

/** 单页快照（items 数组序 = z 序，导出前已按 zIndex 稳定排序） */
export interface PptExportSlide {
  items: PptExportItem[]
}

/** 整个文档的导出快照（二维：slides × items） */
export interface PptExportSnapshot {
  w: number
  h: number
  slides: PptExportSlide[]
}
