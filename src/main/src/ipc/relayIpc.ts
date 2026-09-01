/**
 * 服务端中转 IPC handler（main 进程）：relay 域透传 RelayService。
 * 与 aiStream 桥同款约定（见 preload/src/ipc/aiStream.ts）：
 * - chatStream 为 invoke：main 内完整跑完中转流，onStart / onChunk 经 contextBridge
 *   代理回调，Promise 在流结束 / 中止后 resolve（{ aborted }），失败 reject。
 * - 取消：relay:abortStream(requestId)（requestId 经 onStart 回传，与 aiStream 相同）。
 * - listModels：普通 invoke 返回模型列表。
 */
import { ipcMain } from 'electron'
import {
  RelayChannels,
  type RelayChatParams,
  type RelayStreamHandlers
} from '~/ipc/relayChannels'
import { chatStream, listModels } from '$/auth/RelayService'

const controllers = new Map<string, AbortController>()
let seq = 0
const nextRequestId = (): string => `relay-stream-${Date.now()}-${seq++}`

export function registerRelayIpc(): void {
  ipcMain.handle(RelayChannels.listModels, (): Promise<Array<{ id: string }>> => listModels())

  ipcMain.handle(
    RelayChannels.chatStream,
    (_event, params: RelayChatParams, handlers: RelayStreamHandlers): Promise<{ aborted: boolean }> => {
      const requestId = nextRequestId()
      const controller = new AbortController()
      controllers.set(requestId, controller)
      const { onStart, onChunk } = handlers ?? {}
      return chatStream(params, controller.signal, {
        onStart: (info) => {
          onStart?.({ requestId, status: info.status, headers: info.headers })
        },
        onChunk: (chunk) => {
          onChunk?.(chunk)
        }
      })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return { aborted: true }
          throw error
        })
        .finally(() => {
          controllers.delete(requestId)
        })
    }
  )

  ipcMain.on(RelayChannels.abortStream, (_event, requestId: string) => {
    controllers.get(requestId)?.abort()
  })
}
