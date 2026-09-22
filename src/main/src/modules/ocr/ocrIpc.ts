/**
 * OCR IPC handler（main 进程）：渲染层 inject.ocr 的实现端。
 */
import { app, ipcMain } from 'electron'
import { closeOcrEngine, ocrRecognizeImage } from './ocrService'
import { OcrChannels } from '~/modules/ocr/ocrChannels'

export function registerOcrIpc(): void {
  ipcMain.handle(OcrChannels.recognize, (_event, path: string) => ocrRecognizeImage(path))
  // 引擎持有原生资源，应用退出时释放（从未创建过则无副作用）
  app.on('will-quit', () => {
    void closeOcrEngine()
  })
}
