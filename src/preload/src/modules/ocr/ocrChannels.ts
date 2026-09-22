/**
 * ocr 域 IPC 契约：通道常量 + 载荷/结果类型。
 * preload 桥与 main handler 共用，保持两侧契约一致。
 */
export const OcrChannels = {
  recognize: 'ocr:recognize'
} as const

/** 单个 OCR 识别行：文本 + 置信度 + 包围盒与四点轮廓（原图像素坐标，左上原点，y 向下） */
export interface OcrLine {
  text: string
  confidence: number
  x: number
  y: number
  w: number
  h: number
  /** 四点四边形轮廓扁平坐标 [x1,y1,x2,y2,x3,y3,x4,y4]（贴合倾斜文字，供遮盖区域直接使用） */
  points: number[]
}

export interface OcrResult {
  width: number
  height: number
  lines: OcrLine[]
}
