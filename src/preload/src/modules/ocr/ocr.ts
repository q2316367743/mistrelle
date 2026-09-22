/**
 * ocr 桥（preload）：图片文字识别的 IPC 薄封装。
 * 实现位于 main（modules/ocr/ocrService.ts + ocrIpc.ts），基于 @arcships/light-ocr 离线识别。
 */
import { ipcRenderer } from 'electron'
import { OcrChannels, type OcrResult } from './ocrChannels'

export const ocrApi = {
  recognize: (path: string): Promise<OcrResult> =>
    ipcRenderer.invoke(OcrChannels.recognize, path)
}
