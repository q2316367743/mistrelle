/**
 * SQLite IPC handler（main 进程）：领域仓储方法的 IPC 透传。
 * 所有 SQL 逻辑在 db/ 下的 DAO 层，此处不出现 SQL；渲染进程只传类型化领域参数。
 */
import { ipcMain } from 'electron'
import { DbChannels, type AihotBatch, type AihotListParams } from '~/dbChannels'
import { initDb } from '$/db/client'
import { aiHotApplyBatch, aiHotClear, aiHotGetMeta, aiHotList } from '$/db/repo/aihotRepo'

export function registerDbIpc(): void {
  // 打开数据库并执行 schema DDL（app ready 后调用，可安全使用 app.getPath）
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
}
