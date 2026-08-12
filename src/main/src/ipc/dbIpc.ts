/**
 * db IPC handler（main 进程）：utools db 兼容层（lmdb）的 IPC 暴露。
 * 全异步 invoke；renderer 仅使用 db.promises.* 形态。
 */
import { ipcMain } from 'electron'
import { utoolsDb } from '$/db/utoolsDb'
import { DbChannels, type DbDoc, type DbPutResult, type DbRemoveResult } from '~/channels'

export function registerDbIpc(): void {
  ipcMain.handle(DbChannels.get, (_event, id: string): DbDoc | null => utoolsDb.get(id))

  ipcMain.handle(DbChannels.put, (_event, doc): DbPutResult => utoolsDb.put(doc))

  ipcMain.handle(DbChannels.remove, (_event, idOrDoc: string | Record<string, unknown>): DbRemoveResult =>
    utoolsDb.remove(idOrDoc)
  )

  ipcMain.handle(DbChannels.bulkDocs, (_event, docs): DbPutResult[] => utoolsDb.bulkDocs(docs))

  ipcMain.handle(DbChannels.allDocs, (_event, key?: string | string[]): DbDoc[] =>
    utoolsDb.allDocs(key)
  )
}
