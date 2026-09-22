/**
 * ocr_image 工具：离线识别本地图片中的全部文字（含每行包围盒 XYWH 与四点轮廓）。
 * 基于 @arcships/light-ocr（PP-OCRv6，main 进程原生引擎，macOS 走 Core ML 加速），不消耗模型额度。
 * 与 image_mosaic 配套：识别结果中每行的 x/y/w/h 可直接作为遮盖区域传入。
 */
import { ToolFunction } from '@/domain'
import { useSettingSecureStore } from '@/windows/main/store/setting/SettingSecureStore'
import { isPathBlacklisted } from '@/utils/sandbox'

export const createOcrImageTool = (): ToolFunction => ({
  name: 'ocr_image',
  label: '识别图片文字',
  description:
    '离线识别本地图片中的全部文字（OCR），返回图片尺寸与每个文本行的内容、置信度、包围盒坐标 ' +
    '（x/y/w/h）与四点轮廓（points，贴合倾斜文字），坐标均为相对原图左上角的像素坐标。' +
    '用于读取图片里的文字内容，或为 image_mosaic 提供要遮盖的文字区域。全程本地识别，不消耗模型额度。',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '图片文件绝对路径（png / jpeg / webp 等）' }
    },
    required: ['path']
  },
  risk: 'safe',
  handler: async (...params: unknown[]) => {
    const { path } = params[0] as { path: string }
    if (!path) return { error: '缺少 path：请输入图片文件路径' }
    const { sandbox } = useSettingSecureStore().state
    if (sandbox.enabled && isPathBlacklisted(path, sandbox.fileBlackList)) {
      return { error: `路径 ${path} 在黑名单中，已被安全策略拦截` }
    }
    try {
      const result = await window.preload.inject.ocr.recognize(path)
      if (!result.lines.length) {
        return {
          path,
          width: result.width,
          height: result.height,
          lines: [],
          note: '图中未识别到文字'
        }
      }
      return {
        path,
        width: result.width,
        height: result.height,
        lines: result.lines,
        note: '坐标为相对原图左上角的像素坐标，x/y/w/h 可直接传给 image_mosaic 的 regions'
      }
    } catch (e) {
      return { error: `文字识别失败：${e instanceof Error ? e.message : String(e)}` }
    }
  }
})
