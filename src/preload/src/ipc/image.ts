/**
 * 文生图桥（preload）：image 域的 IPC 薄封装 + 记录变更订阅。
 * 任务编排与运行态在 main（ImageService 单例），渲染层只发指令并经广播感知进展。
 */
import { ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import {
  ImageChannels,
  type ImageGenerateInvokeResult,
  type ImageGenerateParams,
  type ImageModelOption
} from './imageChannels'
import type { ImageListParams, ImageListResult, ImageRecordInput } from './dbChannels'

export const imageApi = {
  /** 生图模型档位选项（服务端直出 label/value；未登录抛错） */
  getModels: (): Promise<ImageModelOption[]> => ipcRenderer.invoke(ImageChannels.getModels),
  /** 发起生成：默认立即返回 pending 记录（进展经 onRecordChanged 广播）；工具直出返回终态 */
  generate: (params: ImageGenerateParams): Promise<ImageGenerateInvokeResult> =>
    ipcRenderer.invoke(ImageChannels.generate, params),
  /** 续轮询一个可恢复的失败记录（同一远端任务，后续状态经广播推进） */
  resume: (id: string): Promise<void> => ipcRenderer.invoke(ImageChannels.resume, id),
  /** 删除记录（联动取消 pending 任务与删除落盘文件） */
  remove: (id: string): Promise<void> => ipcRenderer.invoke(ImageChannels.remove, id),
  /** 分页查询生成记录（筛选 / 排序 / 分页在 SQL 内完成） */
  list: (params: ImageListParams): Promise<ImageListResult> =>
    ipcRenderer.invoke(ImageChannels.list, params),
  /** 订阅记录生命周期广播；返回取消订阅函数 */
  onRecordChanged: (callback: (record: ImageRecordInput) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, record: ImageRecordInput): void => callback(record)
    ipcRenderer.on(ImageChannels.recordChanged, listener)
    return () => {
      ipcRenderer.removeListener(ImageChannels.recordChanged, listener)
    }
  }
}
