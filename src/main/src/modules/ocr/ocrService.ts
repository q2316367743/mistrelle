/**
 * OCR 服务（main 进程）：基于 @arcships/light-ocr（PP-OCRv6 离线原生引擎，macOS 走 Core ML 加速）。
 * engine 懒加载单例：首次识别时创建（加载模型较慢），应用退出时释放；
 * 识别在引擎内部 worker 执行不阻塞主线程，并发调用由引擎内部排队。
 */
import { readFile } from 'node:fs/promises'
import { createEngine } from '@arcships/light-ocr'
import sharp from 'sharp'
import type { OcrLine, OcrResult } from '~/modules/ocr/ocrChannels'

type OcrEngine = Awaited<ReturnType<typeof createEngine>>

let enginePromise: Promise<OcrEngine> | null = null

const getEngine = (): Promise<OcrEngine> => {
  if (!enginePromise) {
    enginePromise = createEngine().catch((e: unknown) => {
      // 创建失败时清空缓存，下次调用可重试（模型加载可能因环境问题失败）
      enginePromise = null
      throw e
    })
  }
  return enginePromise
}

export const closeOcrEngine = async (): Promise<void> => {
  const promise = enginePromise
  enginePromise = null
  if (!promise) return
  const engine = await promise.catch(() => null)
  await engine?.close()
}

/**
 * 四点四边形 → 包围盒 XYWH + 四点轮廓（像素取整）：
 * 包围盒供旧的矩形口径（列表 / 点选 / image_mosaic regions）使用，
 * 轮廓点供遮盖区域直接落盘（贴合倾斜文字，渲染按多边形裁剪）。
 */
const boxToLine = (
  box: readonly { x: number; y: number }[],
  line: { text: string; confidence: number }
): OcrLine => {
  const xs = box.map((p) => p.x)
  const ys = box.map((p) => p.y)
  const x0 = Math.min(...xs)
  const y0 = Math.min(...ys)
  const points: number[] = []
  for (const point of box) {
    points.push(Math.round(point.x), Math.round(point.y))
  }
  return {
    text: line.text,
    confidence: line.confidence,
    x: Math.round(x0),
    y: Math.round(y0),
    w: Math.round(Math.max(...xs) - x0),
    h: Math.round(Math.max(...ys) - y0),
    points
  }
}

/** 识别本地图片中的文字：返回图片尺寸与全部文本行（含包围盒与四点轮廓，原图像素坐标，左上原点） */
export const ocrRecognizeImage = async (path: string): Promise<OcrResult> => {
  const meta = await sharp(path).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (!width || !height) throw new Error(`无法读取图片：${path}`)
  const engine = await getEngine()
  const result = await engine.recognizeEncoded(await readFile(path))
  return { width, height, lines: result.lines.map((line) => boxToLine(line.box, line)) }
}
