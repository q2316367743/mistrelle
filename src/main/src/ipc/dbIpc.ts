/**
 * SQLite IPC handler（main 进程）：领域仓储方法的 IPC 透传。
 * 所有 SQL 逻辑在 db/ 下的 DAO 层，此处不出现 SQL；渲染进程只传类型化领域参数。
 */
import { ipcMain } from 'electron'
import {
  DbChannels,
  type AihotBatch,
  type AihotListParams,
  type ChatItemInput
} from '~/dbChannels'
import { initDb } from '$/db/client'
import { aiHotApplyBatch, aiHotClear, aiHotGetMeta, aiHotList } from '$/db/repo/aihotRepo'
import {
  chatDeleteItem,
  chatGetContent,
  chatGetStamp,
  chatGetSub,
  chatList,
  chatSetContent,
  chatSetSub,
  chatUpsertItem
} from '$/db/repo/chatRepo'

export function registerDbIpc(): void {
  // 打开数据库并应用 drizzle 迁移（app ready 后调用，可安全使用 app.getPath）
  initDb()

  ipcMain.handle(
    DbChannels.aihotList,
    (_event, params: AihotListParams): ReturnType<typeof aiHotList> =>
      aiHotList(params.filter, params.limit, params.offset)
  )
  ipcMain.handle(DbChannels.aihotApplyBatch, (_event, batch: AihotBatch): void =>
    aiHotApplyBatch(batch)
  )
  ipcMain.handle(DbChannels.aihotClear, (): void => aiHotClear())
  ipcMain.handle(DbChannels.aihotGetMeta, (): ReturnType<typeof aiHotGetMeta> => aiHotGetMeta())

  ipcMain.handle(DbChannels.chatList, (): ReturnType<typeof chatList> => chatList())
  ipcMain.handle(DbChannels.chatUpsertItem, (_event, item: ChatItemInput): void =>
    chatUpsertItem(item)
  )
  ipcMain.handle(DbChannels.chatDeleteItem, (_event, id: string): void => chatDeleteItem(id))
  ipcMain.handle(DbChannels.chatGetContent, (_event, chatId: string): ReturnType<typeof chatGetContent> =>
    chatGetContent(chatId)
  )
  ipcMain.handle(
    DbChannels.chatSetContent,
    (_event, chatId: string, data: string, updatedTime: number): void =>
      chatSetContent(chatId, data, updatedTime)
  )
  ipcMain.handle(DbChannels.chatGetSub, (_event, chatId: string, subId: string): string | null =>
    chatGetSub(chatId, subId)
  )
  ipcMain.handle(DbChannels.chatSetSub, (_event, chatId: string, subId: string, data: string): void =>
    chatSetSub(chatId, subId, data)
  )
  ipcMain.handle(DbChannels.chatGetStamp, (_event, chatId: string): number | null =>
    chatGetStamp(chatId)
  )
}
