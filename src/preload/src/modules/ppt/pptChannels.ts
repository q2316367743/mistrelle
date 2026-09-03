/**
 * ppt 域 IPC 契约：SlideNode / PptJsonDoc / 导出快照类型 + 通道常量。
 * preload 桥与 main handler 共用；类型与 renderer 的 modules/ppt/pptTypes.ts 形状一致，修改需同步。
 */
// ── ppt ────────────────────────────────────────────────────
/**
 * SlideNode：通用节点（tag 即渲染组件类型），child 为字符串表示文本内容。
 * id 为节点唯一标识（**顶层字段，与 tag 并列**，自动生成）：不进 attr、不参与布局，
 * 服务节点点选引用与 ppt_batch_edit 精准编辑。
 * 注意：与 renderer 的 src/renderer/src/modules/ppt/pptTypes.ts 形状一致，修改需同步。
 */
export interface SlideNode {
  id?: string
  tag: string
  attr: Record<string, string>
  child: Array<SlideNode> | string
}

/**
 * PPT 文档 JSON（存储文件 {name}.ppt.json 的内容）：
 * slide 每项是一页的根节点数组；预览由渲染进程 vueRender 直接渲染。
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

// ── 导出快照（与 renderer pptTypes.ts 同步；坐标为画布 px） ──

export interface PptItemBase {
  x: number
  y: number
  w: number
  h: number
  /** 旋转（度，顺时针，绕中心） */
  rotate?: number
  opacity?: number
  zIndex?: number
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
  shapeType: string
  fill?: PptFillInput
  stroke?: PptStrokeInput
  shadow?: PptShadowInput
}

export interface PptImageItem extends PptItemBase {
  kind: 'image'
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

export interface PptExportSlide {
  items: PptExportItem[]
}

export interface PptExportSnapshot {
  w: number
  h: number
  slides: PptExportSlide[]
}

export const PptChannels = {
  /** PptExportSnapshot → 构建 PPTX 并直接落盘（导出 PPTX；主进程 PptxGenJS 按绝对坐标摆放） */
  exportPptx: 'ppt:exportPptx',
  /** PNG dataURL 列表落盘（渲染进程 canvas 绘制；单页为文件路径，多页为目录 page-{n}.png） */
  writePngFiles: 'ppt:writePngFiles'
} as const

export interface PptExportPptxOptions {
  /** PPTX 文件保存路径 */
  path: string
}

export interface PptWritePngFilesOptions {
  /** 单页导出为文件路径；多页导出为目录（每页写 page-{n}.png） */
  targetPath: string
  /** 各图对应的 1 起始页码 */
  pages: number[]
}
