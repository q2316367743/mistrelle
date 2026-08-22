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
  type AihotMeta,
  type ChatContentResult,
  type ChatItemInput
} from './dbChannels'

/** 列表行（top 为 0/1 整数，渲染侧转 boolean） */
export interface ChatItemRow extends Omit<ChatItemInput, 'top'> {
  top: number
}

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
    getMeta: (): Promise<AihotMeta> => ipcRenderer.invoke(DbChannels.aihotGetMeta),
    /** 标记单条为已读（点击打开资讯条目时调用） */
    markRead: (id: string): Promise<void> => ipcRenderer.invoke(DbChannels.aihotMarkRead, id)
  },
  chat: {
    /** 聊天列表（created_at 倒序，top 为 0/1） */
    list: (): Promise<ChatItemRow[]> => ipcRenderer.invoke(DbChannels.chatList),
    /** 列表行 upsert（新增 / 更名 / 置顶等） */
    upsertItem: (item: ChatItemInput): Promise<void> =>
      ipcRenderer.invoke(DbChannels.chatUpsertItem, item),
    /** 删除聊天（单事务级联删列表行 + 消息体 + 子代理消息体） */
    deleteItem: (id: string): Promise<void> => ipcRenderer.invoke(DbChannels.chatDeleteItem, id),
    /** 读取消息体（data 为完整 AiChatContent JSON；缺行为 null） */
    getContent: (chatId: string): Promise<ChatContentResult> =>
      ipcRenderer.invoke(DbChannels.chatGetContent, chatId),
    /** 整聊保存消息体（data 为完整 AiChatContent JSON） */
    setContent: (chatId: string, data: string, updatedTime: number): Promise<void> =>
      ipcRenderer.invoke(DbChannels.chatSetContent, chatId, data, updatedTime),
    /** 读取子代理消息体 JSON（缺行为 null） */
    getSub: (chatId: string, subId: string): Promise<string | null> =>
      ipcRenderer.invoke(DbChannels.chatGetSub, chatId, subId),
    /** 保存子代理消息体 JSON */
    setSub: (chatId: string, subId: string, data: string): Promise<void> =>
      ipcRenderer.invoke(DbChannels.chatSetSub, chatId, subId, data),
    /** 消息体更新时间戳（记忆提取未变跳过；缺行返回 null） */
    getStamp: (chatId: string): Promise<number | null> =>
      ipcRenderer.invoke(DbChannels.chatGetStamp, chatId)
  }
}
