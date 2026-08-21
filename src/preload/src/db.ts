/**
 * SQLite 桥（preload）：领域仓储方法的 IPC 薄封装，实现位于 main（dbIpc.ts + db/）。
 * 渲染进程不感知 DB 文件路径、不拼 SQL，只调用类型化领域方法。
 */
import { ipcRenderer } from 'electron'
import {
  DbChannels,
  type AihotBatch,
  type AihotListParams,
  type AihotListResult,
  type AihotMeta
} from './dbChannels'

export const dbApi = {
  aihot: {
    /** 分页查询精选列表（筛选 / 排序 / 分页在 SQL 内完成） */
    list: (params: AihotListParams): Promise<AihotListResult> =>
      ipcRenderer.invoke(DbChannels.aihotList, params),
    /** 应用一批变更（delete + upsert + meta 水位），单事务原子完成 */
    applyBatch: (batch: AihotBatch): Promise<void> =>
      ipcRenderer.invoke(DbChannels.aihotApplyBatch, batch),
    /** 清空精选数据与元数据（409 重引导时） */
    clear: (): Promise<void> => ipcRenderer.invoke(DbChannels.aihotClear),
    /** 读取账本元数据（schemaVersion / fields / cursor 水位 / syncedAt） */
    getMeta: (): Promise<AihotMeta> => ipcRenderer.invoke(DbChannels.aihotGetMeta)
  }
}
