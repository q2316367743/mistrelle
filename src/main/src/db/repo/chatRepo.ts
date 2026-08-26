/**
 * 聊天域仓储（main 进程）：chat / chat_content / chat_sub 表读写。
 *
 * - 列表按行 upsert/delete（替代原 index.json 全量重写）。
 * - chat_content 每聊天一行存完整 AiChatContent JSON（含 messages），读写粒度与原
 *   main.json 一致；updated_time 供记忆提取做未变跳过（替代原文件 mtime）。
 * - chatDeleteItem 在单事务内级联删 item + content + sub。
 */
import { db } from '../client'
import { desc, eq, sql } from 'drizzle-orm'
import { chat, chatContent, chatSub } from '../schema/chat'
import type { ChatContentResult, ChatItemInput } from '~/dbChannels'

/** 列表行（top 为 0/1 整数，投影 / 可选列以 drizzle 行类型为准，渲染侧转 boolean） */
export function chatList() {
  return db().select().from(chat).orderBy(desc(chat.createdAt)).all()
}

const itemSet = {
  name: sql`excluded.name`,
  top: sql`excluded.top`,
  privacy: sql`excluded.privacy`,
  workspace: sql`excluded.workspace`,
  projectId: sql`excluded.project_id`,
  taskId: sql`excluded.task_id`,
  type: sql`excluded.type`,
  createdAt: sql`excluded.created_at`,
  updatedAt: sql`excluded.updated_at`
}

export function chatUpsertItem(item: ChatItemInput): void {
  db()
    .insert(chat)
    .values({
      id: item.id,
      name: item.name,
      top: item.top ? 1 : 0,
      privacy: item.privacy ? 1 : 0,
      workspace: item.workspace,
      projectId: item.projectId ?? null,
      taskId: item.taskId ?? null,
      type: item.type ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    })
    .onConflictDoUpdate({ target: chat.id, set: itemSet })
    .run()
}

/** 单行读取（渲染侧隐私标记水合等轻量查询；缺行返回 null） */
export function chatGetItem(id: string) {
  return db().select().from(chat).where(eq(chat.id, id)).get() ?? null
}

export function chatDeleteItem(id: string): void {
  db().transaction((tx) => {
    tx.delete(chat).where(eq(chat.id, id)).run()
    tx.delete(chatContent).where(eq(chatContent.chatId, id)).run()
    tx.delete(chatSub).where(eq(chatSub.chatId, id)).run()
  })
}

export function chatGetContent(chatId: string): ChatContentResult {
  const row = db()
    .select({ data: chatContent.data, updatedTime: chatContent.updatedTime })
    .from(chatContent)
    .where(eq(chatContent.chatId, chatId))
    .get()
  return row ? { data: row.data, updatedTime: row.updatedTime } : { data: null, updatedTime: null }
}

export function chatSetContent(chatId: string, data: string, updatedTime: number): void {
  db()
    .insert(chatContent)
    .values({ chatId, data, updatedTime })
    .onConflictDoUpdate({
      target: chatContent.chatId,
      set: { data: sql`excluded.data`, updatedTime: sql`excluded.updated_time` }
    })
    .run()
}

export function chatGetSub(chatId: string, subId: string): string | null {
  const row = db()
    .select({ data: chatSub.data })
    .from(chatSub)
    .where(sql`${chatSub.chatId} = ${chatId} and ${chatSub.subId} = ${subId}`)
    .get()
  return row?.data ?? null
}

export function chatSetSub(chatId: string, subId: string, data: string): void {
  db()
    .insert(chatSub)
    .values({ chatId, subId, data })
    .onConflictDoUpdate({
      target: [chatSub.chatId, chatSub.subId],
      set: { data: sql`excluded.data` }
    })
    .run()
}

/** 消息体更新时间戳（记忆提取未变跳过；缺行返回 null） */
export function chatGetStamp(chatId: string): number | null {
  const row = db()
    .select({ updatedTime: chatContent.updatedTime })
    .from(chatContent)
    .where(eq(chatContent.chatId, chatId))
    .get()
  return row?.updatedTime ?? null
}
