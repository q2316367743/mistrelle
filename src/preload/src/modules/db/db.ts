/**
 * SQLite 桥（preload）：领域仓储方法的 IPC 薄封装，实现位于 main（dbIpc.ts + db/）。
 * 渲染进程不感知 DB 文件路径、不拼 SQL，只调用类型化领域方法。
 */
import { ipcRenderer } from 'electron'
import {
  DbChannels,
  type ChatContentResult,
  type ChatItemInput,
  type CompareListParams,
  type CompareListResult,
  type CompareQuestionInput,
  type CompareRecordInput,
  type HealthListParams,
  type HealthListResult,
  type HealthRecordInput
} from './dbChannels'

/** 列表行（top / privacy 为 0/1 整数，渲染侧转 boolean） */
export interface ChatItemRow extends Omit<ChatItemInput, 'top' | 'privacy'> {
  top: number
  privacy: number
}

export const dbApi = {
  chat: {
    /** 聊天列表（created_at 倒序，top / privacy 为 0/1） */
    list: (): Promise<ChatItemRow[]> => ipcRenderer.invoke(DbChannels.chatList),
    /** 单行读取（隐私标记水合等轻量查询；缺行为 null） */
    getItem: (id: string): Promise<ChatItemRow | null> => ipcRenderer.invoke(DbChannels.chatGetItem, id),
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
  },
  health: {
    /** 分页查询检测记录（created_at 倒序） */
    list: (params: HealthListParams): Promise<HealthListResult> =>
      ipcRenderer.invoke(DbChannels.healthList, params),
    /** 记录 upsert（插入 running / 逐项累积 / 收尾 finished|stopped） */
    upsert: (record: HealthRecordInput): Promise<void> =>
      ipcRenderer.invoke(DbChannels.healthUpsert, record),
    /** 删除单条检测记录 */
    delete: (id: string): Promise<void> => ipcRenderer.invoke(DbChannels.healthDelete, id)
  },
  compare: {
    question: {
      /** 题库全量（order_index 升序，answerKeys 已解析为数组） */
      list: (): Promise<CompareQuestionInput[]> =>
        ipcRenderer.invoke(DbChannels.compareQuestionList),
      /** 单题新增 / 编辑 / 启停（按 key upsert） */
      upsert: (question: CompareQuestionInput): Promise<void> =>
        ipcRenderer.invoke(DbChannels.compareQuestionUpsert, question),
      /** 删除单题 */
      delete: (key: string): Promise<void> =>
        ipcRenderer.invoke(DbChannels.compareQuestionDelete, key),
      /** 全量替换题库（恢复默认，单事务） */
      replaceAll: (questions: CompareQuestionInput[]): Promise<void> =>
        ipcRenderer.invoke(DbChannels.compareQuestionReplaceAll, questions)
    },
    record: {
      /** 分页查询对比记录（created_at 倒序） */
      list: (params: CompareListParams): Promise<CompareListResult> =>
        ipcRenderer.invoke(DbChannels.compareList, params),
      /** 记录 upsert（插入 running / 逐阶段累积 / 收尾 finished|stopped） */
      upsert: (record: CompareRecordInput): Promise<void> =>
        ipcRenderer.invoke(DbChannels.compareUpsert, record),
      /** 删除单条对比记录 */
      delete: (id: string): Promise<void> => ipcRenderer.invoke(DbChannels.compareDelete, id)
    }
  }
}
