/**
 * 文生图 IPC handler（main 进程）：指令透传 ImageService，列表查询透传 imageRepo。
 * 任务编排与运行态全在 ImageService（含广播），此处不做业务逻辑。
 */
import { ipcMain } from 'electron'
import {
  ImageChannels,
  type ImageGenerateInvokeResult,
  type ImageGenerateParams,
  type ImageModelOption
} from '~/modules/image/imageChannels'
import type { ImageListParams } from '~/modules/db/dbChannels'
import { imageList } from '$/db/repo/imageRepo'
import {
  cleanupOrphans,
  removeGeneration,
  resumeGeneration,
  startGeneration
} from './ImageService'
import { imageModels } from '../relay/RelayService'

export function registerImageIpc(): void {
  // 遗留 pending 收尾（DB 已由 registerDbIpc 初始化，注册顺序保证 db 在前）
  cleanupOrphans()

  // 档位选项（公开 / priced；渲染层下拉直接绑定）
  ipcMain.handle(ImageChannels.getModels, (): Promise<ImageModelOption[]> => imageModels())
  ipcMain.handle(
    ImageChannels.generate,
    (_event, params: ImageGenerateParams): Promise<ImageGenerateInvokeResult> =>
      startGeneration(params)
  )
  ipcMain.handle(ImageChannels.resume, (_event, id: string): Promise<void> => resumeGeneration(id))
  ipcMain.handle(ImageChannels.remove, (_event, id: string): void => removeGeneration(id))
  ipcMain.handle(ImageChannels.list, (_event, params: ImageListParams) =>
    imageList(params.filter, params.limit, params.offset)
  )
}
