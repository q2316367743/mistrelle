/**
 * 服务端中转 IPC handler（main 进程）：relay 域透传 RelayService。
 *
 * - listModels：普通 invoke 返回模型列表。
 * - chatStream：invoke 只收可克隆的 params + requestId（函数无法 structured clone，
 *   不能把 onStart/onChunk 当 invoke 参数，否则报 An object could not be cloned）。
 *   流式回调经 webContents.send 回推 start/chunk/end；结束以 end 事件为准。
 * - 取消：relay:abortStream(requestId)（requestId 经 start 事件回传）。
 */
import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import {
  RelayChannels,
  type RelayChatParams,
  type RelayStreamEndPayload
} from '~/modules/relay/relayChannels'
import { chatStream, listModels } from './RelayService'

const controllers = new Map<string, AbortController>()

const send = (event: IpcMainInvokeEvent, channel: string, ...args: unknown[]): void => {
  if (event.sender.isDestroyed()) return
  event.sender.send(channel, ...args)
}

export function registerRelayIpc(): void {
  ipcMain.handle(RelayChannels.listModels, (): Promise<Array<{ id: string }>> => listModels())

  ipcMain.handle(
    RelayChannels.chatStream,
    async (
      event: IpcMainInvokeEvent,
      params: RelayChatParams,
      requestId: string
    ): Promise<void> => {
      if (typeof requestId !== 'string' || requestId.length === 0) {
        throw new Error('invalid requestId')
      }
      const controller = new AbortController()
      controllers.set(requestId, controller)
      const emitEnd = (payload: Omit<RelayStreamEndPayload, 'requestId'>): void => {
        send(event, RelayChannels.chatStreamEnd, { requestId, ...payload })
      }
      try {
        const result = await chatStream(params, controller.signal, {
          onStart: (info) => {
            send(event, RelayChannels.chatStreamStart, {
              requestId,
              status: info.status,
              headers: info.headers
            })
          },
          onChunk: (chunk) => {
            send(event, RelayChannels.chatStreamChunk, requestId, chunk)
          }
        })
        emitEnd({ aborted: result.aborted })
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          emitEnd({ aborted: true })
          return
        }
        emitEnd({ error: error instanceof Error ? error.message : String(error) })
      } finally {
        controllers.delete(requestId)
      }
    }
  )

  ipcMain.on(RelayChannels.abortStream, (_event, requestId: string) => {
    controllers.get(requestId)?.abort()
  })
}
