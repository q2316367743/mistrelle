/**
 * SQLite IPC handler（main 进程）：领域仓储方法的 IPC 透传。
 * 所有 SQL 逻辑在 db/ 下的 DAO 层，此处不出现 SQL；渲染进程只传类型化领域参数。
 */
import { ipcMain } from 'electron'
import {
  DbChannels,
  type ChatItemInput,
  type CompareListParams,
  type CompareQuestionInput,
  type CompareRecordInput,
  type HealthListParams,
  type HealthRecordInput
} from '~/modules/db/dbChannels'
import { initDb } from '$/db/client'
import {
  compareQuestionDelete,
  compareQuestionList,
  compareQuestionReplaceAll,
  compareQuestionUpsert,
  compareRecordDelete,
  compareRecordList,
  compareRecordUpsert
} from '$/db/repo/compareRepo'
import { healthDelete, healthList, healthUpsert } from '$/db/repo/healthRepo'
import {
  chatDeleteItem,
  chatGetContent,
  chatGetItem,
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

  ipcMain.handle(DbChannels.chatList, (): ReturnType<typeof chatList> => chatList())
  ipcMain.handle(DbChannels.chatGetItem, (_event, id: string) => chatGetItem(id))
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

  ipcMain.handle(
    DbChannels.healthList,
    (_event, params: HealthListParams): ReturnType<typeof healthList> =>
      healthList(params.limit, params.offset)
  )
  ipcMain.handle(DbChannels.healthUpsert, (_event, record: HealthRecordInput): void =>
    healthUpsert(record)
  )
  ipcMain.handle(DbChannels.healthDelete, (_event, id: string): void => healthDelete(id))

  // 模型对比检测域（题库 + 对比记录）
  ipcMain.handle(DbChannels.compareQuestionList, (): ReturnType<typeof compareQuestionList> =>
    compareQuestionList()
  )
  ipcMain.handle(DbChannels.compareQuestionUpsert, (_event, question: CompareQuestionInput): void =>
    compareQuestionUpsert(question)
  )
  ipcMain.handle(DbChannels.compareQuestionDelete, (_event, key: string): void =>
    compareQuestionDelete(key)
  )
  ipcMain.handle(
    DbChannels.compareQuestionReplaceAll,
    (_event, questions: CompareQuestionInput[]): void =>
      compareQuestionReplaceAll(questions)
  )
  ipcMain.handle(
    DbChannels.compareList,
    (_event, params: CompareListParams): ReturnType<typeof compareRecordList> =>
      compareRecordList(params.limit, params.offset)
  )
  ipcMain.handle(DbChannels.compareUpsert, (_event, record: CompareRecordInput): void =>
    compareRecordUpsert(record)
  )
  ipcMain.handle(DbChannels.compareDelete, (_event, id: string): void => compareRecordDelete(id))
}
