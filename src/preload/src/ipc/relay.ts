/**
 * 服务端中转桥（preload）：relay 域的 IPC 薄封装。
 * 与 aiStream 桥同款约定（见 ./aiStream.ts）：只做字节转发，协议解析在渲染层 modules/ai；
 * onStart / onChunk 回调经 contextBridge 代理传入，invoke 的 Promise 在流结束/中止后 resolve。
 */
import { ipcRenderer } from 'electron'
import {
  RelayChannels,
  type RelayChatParams,
  type RelayStreamHandlers
} from './relayChannels'

export const relayApi = {
  /** 拉取内置模型列表（GET {server}/v1/models；未登录抛错） */
  listModels: (): Promise<Array<{ id: string }>> => ipcRenderer.invoke(RelayChannels.listModels),

  /**
   * 发起中转对话流（POST {server}/v1/chat/completions）。
   * Promise 在流结束/中止后 resolve（{ aborted }），失败 reject。
   * 取消：streamAbort(requestId)（requestId 经 onStart 回传）。
   */
  chatStream: (
    params: RelayChatParams,
    handlers: RelayStreamHandlers
  ): Promise<{ aborted: boolean }> => ipcRenderer.invoke(RelayChannels.chatStream, params, handlers),

  /** 取消进行中的中转对话流 */
  streamAbort: (requestId: string): void => {
    ipcRenderer.send(RelayChannels.abortStream, requestId)
  }
}
