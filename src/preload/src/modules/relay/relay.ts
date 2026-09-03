/**
 * 服务端中转桥（preload）：relay 域的 IPC 薄封装。
 *
 * HTTP 必须在 main 注入凭证，handlers 又不能跨 IPC 克隆（函数无法 structured clone）。
 * 因此：invoke 只传可克隆的 params + requestId；onStart / onChunk / 结束走事件回推，
 * 在 preload 本地调用经 contextBridge 代理进来的 handlers。
 */
import { ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  RelayChannels,
  type RelayChatParams,
  type RelayStreamEndPayload,
  type RelayStreamHandlers
} from './relayChannels'

let seq = 0
const nextRequestId = (): string => `relay-stream-${Date.now()}-${seq++}`

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
  ): Promise<{ aborted: boolean }> => {
    const requestId = nextRequestId()
    const { onStart, onChunk } = handlers

    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (error?: unknown, result?: { aborted: boolean }): void => {
        if (settled) return
        settled = true
        ipcRenderer.removeListener(RelayChannels.chatStreamStart, onStartEvent)
        ipcRenderer.removeListener(RelayChannels.chatStreamChunk, onChunkEvent)
        ipcRenderer.removeListener(RelayChannels.chatStreamEnd, onEndEvent)
        if (error !== undefined) {
          reject(error instanceof Error ? error : new Error(String(error)))
          return
        }
        resolve(result ?? { aborted: false })
      }

      const onStartEvent = (
        _event: IpcRendererEvent,
        info: { requestId: string; status: number; headers: Record<string, string> }
      ): void => {
        if (info.requestId !== requestId) return
        onStart?.(info)
      }
      const onChunkEvent = (
        _event: IpcRendererEvent,
        id: string,
        chunk: ArrayBuffer
      ): void => {
        if (id !== requestId) return
        onChunk?.(chunk)
      }
      const onEndEvent = (_event: IpcRendererEvent, payload: RelayStreamEndPayload): void => {
        if (payload.requestId !== requestId) return
        if (payload.error) finish(new Error(payload.error))
        else finish(undefined, { aborted: !!payload.aborted })
      }

      ipcRenderer.on(RelayChannels.chatStreamStart, onStartEvent)
      ipcRenderer.on(RelayChannels.chatStreamChunk, onChunkEvent)
      ipcRenderer.on(RelayChannels.chatStreamEnd, onEndEvent)
      ipcRenderer.invoke(RelayChannels.chatStream, params, requestId).catch((error: unknown) => {
        finish(error)
      })
    })
  },

  /** 取消进行中的中转对话流 */
  streamAbort: (requestId: string): void => {
    ipcRenderer.send(RelayChannels.abortStream, requestId)
  }
}
