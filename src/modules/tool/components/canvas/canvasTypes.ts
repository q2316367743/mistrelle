/**
 * 画布数据类型（.canvas 文件即此结构的 JSON 序列化）。
 * 采用 leafer 兼容的字段命名，便于渲染层直接映射。
 */

export type CanvasShapeType = 'rect' | 'ellipse' | 'text' | 'line' | 'image'

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
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  // ── 文本 ──
  text?: string
  fontSize?: number
  fontWeight?: number
  fontFamily?: string
  textColor?: string
  // ── 线条 ──
  points?: Array<number>
  // ── 图片 ──
  imageUrl?: string
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
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  text?: string
  fontSize?: number
  fontWeight?: number
  fontFamily?: string
  textColor?: string
  points?: Array<number>
  imageUrl?: string
}
