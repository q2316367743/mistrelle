/**
 * sharp 域 IPC 契约：通道常量 + 载荷/结果类型。
 * preload 桥与 main handler 共用，保持两侧契约一致。
 */
// ── sharp ──────────────────────────────────────────────────
export const SharpChannels = {
  metadata: 'sharp:metadata',
  crop: 'sharp:crop',
  removeBackground: 'sharp:removeBackground',
  colorMap: 'sharp:colorMap',
  mask: 'sharp:mask'
} as const

export interface SharpRegion {
  left: number
  top: number
  width: number
  height: number
}

export interface SharpMetadata {
  format?: string
  width?: number
  height?: number
  space?: string
  channels?: number
}

export interface SharpCropResult {
  width?: number
  height?: number
}

/** 遮盖方式：mosaic 像素块马赛克 / blur 毛玻璃（高斯模糊） */
export type SharpCoverStyle = 'mosaic' | 'blur'

/** 遮盖参数（缺省 mosaic + MOSAIC_CELL_PX；越界值会在 main 侧再钳制一次） */
export interface SharpCoverOptions {
  style?: SharpCoverStyle
  /** 马赛克像素块边长（px，越小越细腻） */
  cellPx?: number
  /** 毛玻璃模糊半径（px） */
  blurPx?: number
}

export interface SharpMaskResult {
  width: number
  height: number
  /** 实际遮盖的区域数（0 表示无有效区域，输出为原图副本） */
  applied: number
}

export interface SharpRemoveBackgroundResult {
  width: number
  height: number
  removedPixels: number
}

export interface SharpColorMapResult {
  width: number
  height: number
  /** 网格列数 / 行数（按宽高比缩放，非强制正方形） */
  cols: number
  rows: number
  /** 全局主色 Top-N，ratio 为该色在非透明格中的占比 */
  palette: Array<{ hex: string; ratio: number }>
  /** 突兀区域 Top-N（按与 8 邻域的最大 LAB ΔE 降序），坐标为原图像素 */
  anomalies: Array<{
    row: number
    col: number
    x: number
    y: number
    width: number
    height: number
    color: string
    deviation: number
  }>
}
