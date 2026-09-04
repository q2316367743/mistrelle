/**
 * 聊天域 Drizzle schema（列表 + 消息体 + 子代理消息体）。
 *
 * 键语义（与渲染层 ChatService 的 storageKey 分流约定一致）：
 * - chat：列表行（侧栏），类型化列，免整份 index.json 解析
 * - chat_content：每聊天一行，data 存完整 AiChatContent JSON（含 messages），
 *   读写粒度与原 main.json 一致（整聊加载 / 整聊节流保存）
 * - chat_sub：子代理消息体（原 message/sub_{subId}.json）
 */
import { index, sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'

export const chat = sqliteTable(
  'chat',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** 置顶标记（0/1） */
    top: integer('top').notNull(),
    /** 隐私聊天标记（0/1）：开启后不注入记忆 / 不注册记忆工具，会话不进入记忆提取 */
    privacy: integer('privacy').notNull().default(0),
    /** 逻辑工作区分组字符串（可为空串，非路径层级） */
    workspace: text('workspace').notNull(),
    projectId: text('project_id'),
    taskId: text('task_id'),
    /** 聊天类型（office/writing/design，创建后锁定） */
    type: text('type'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
  },
  (t) => [index('idx_chat_created').on(t.createdAt)]
)

export const chatContent = sqliteTable('chat_content', {
  chatId: text('chat_id').primaryKey(),
  /** 消息体更新时间戳（记忆提取的未变跳过依据，替代原文件 mtime） */
  updatedTime: integer('updated_time').notNull(),
  /** 完整 AiChatContent JSON（messages/draft/todos/subAgents 等） */
  data: text('data').notNull()
})

/**
 * 子代理消息体（原 message/sub_{subId}.json）。
 * 复合主键 (chat_id, sub_id)：chatSetSub 的 onConflictDoUpdate 以此为冲突目标，
 * 缺失约束会抛「ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint」；
 * 复合主键最左前缀已覆盖按 chatId 的查询，无需另建索引。
 */
export const chatSub = sqliteTable(
  'chat_sub',
  {
    chatId: text('chat_id').notNull(),
    subId: text('sub_id').notNull(),
    /** 完整 AiChatContent JSON（子代理 messages） */
    data: text('data').notNull()
  },
  (t) => [primaryKey({ columns: [t.chatId, t.subId] })]
)
