import type { AiGroupChat, AiGroupChatContext, AiGroupChatMemory } from '@/entity/ai'
import { buildAiGroupChat, DEFAULT_CONTEXT_EXPIRY_HOURS } from '@/entity/ai'
import type { ToolFunction } from '@/domain'
import { useSnowflake } from '@/hooks'
import { buildDiscussionFolderPath, enqueueByPath } from '@/modules/discussion/DiscussionRecordService'

// ==========================================
//  路径
// ==========================================

const buildChatPath = (discussionId: string) =>
  window.preload.path.join(buildDiscussionFolderPath(discussionId), 'chat.json')

const buildMemoryFolderPath = (discussionId: string) =>
  window.preload.path.join(buildDiscussionFolderPath(discussionId), 'memory')

const buildMemoryPath = (discussionId: string, date: string) =>
  window.preload.path.join(buildMemoryFolderPath(discussionId), `${date}.json`)

/** 格式化为 YYYY-MM-DD（本地时区） */
const formatDate = (time: number): string => {
  const d = new Date(time)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ==========================================
//  群聊读写
// ==========================================

export const groupChatGet = async (discussionId: string): Promise<AiGroupChat> => {
  const path = buildChatPath(discussionId)
  if (!window.preload.fs.existsSync(path)) return buildAiGroupChat(discussionId)
  try {
    const text = await window.preload.fs.readTextFile(path)
    const parsed = JSON.parse(text) as AiGroupChat
    if (!parsed.contexts?.length || !parsed.activeContextId) return buildAiGroupChat(discussionId)
    return parsed
  } catch {
    return buildAiGroupChat(discussionId)
  }
}

export const groupChatSave = async (chat: AiGroupChat): Promise<void> => {
  const path = buildChatPath(chat.discussionId)
  await enqueueByPath(path, () => window.preload.fs.writeTextFile(path, JSON.stringify(chat)))
}

// ==========================================
//  聊天记录清空
// ==========================================

/** 逻辑清空：标记 clearedAt，实际消息数据保留，用于后续界面过滤 */
export const clearChatLogically = (chat: AiGroupChat, now: number): void => {
  chat.clearedAt = now
}

/** 完全清空：删除 chat.json 与 memory 文件夹，返回全新的空 chat */
export const clearChatCompletely = async (discussionId: string): Promise<AiGroupChat> => {
  const chatPath = buildChatPath(discussionId)
  const memoryPath = buildMemoryFolderPath(discussionId)
  if (window.preload.fs.existsSync(chatPath)) {
    await enqueueByPath(chatPath, async () => {
      if (window.preload.fs.existsSync(chatPath)) await window.preload.fs.rm(chatPath)
    })
  }
  if (window.preload.fs.existsSync(memoryPath)) {
    await window.preload.fs.rm(memoryPath)
  }
  return buildAiGroupChat(discussionId)
}

// ==========================================
//  上下文（作用于内存中的 AiGroupChat 对象，调用方负责落盘）
// ==========================================

export const getActiveContext = (chat: AiGroupChat): AiGroupChatContext => {
  const ctx = chat.contexts.find((e) => e.id === chat.activeContextId)
  // 理论上 activeContextId 永远有效；兜底重建
  if (ctx) return ctx
  const fresh: AiGroupChatContext = {
    id: useSnowflake().nextId(),
    startedAt: Date.now(),
    lastActivityAt: Date.now()
  }
  chat.contexts.push(fresh)
  chat.activeContextId = fresh.id
  return fresh
}

/** 当前激活上下文是否已过期（按 lastActivityAt 滚动计算） */
export const isContextExpired = (chat: AiGroupChat, now: number): boolean => {
  const ctx = getActiveContext(chat)
  const windowMs = chat.contextExpiryHours * 3600 * 1000
  return now - ctx.lastActivityAt > windowMs
}

/** 确保当前上下文可用：过期则开新上下文；否则刷新最近活动时间。返回当前激活上下文 */
export const ensureFreshContext = (chat: AiGroupChat, now: number): AiGroupChatContext => {
  if (isContextExpired(chat, now)) return createNewContext(chat, now)
  const ctx = getActiveContext(chat)
  ctx.lastActivityAt = now
  return ctx
}

/** 强制开启新上下文 */
export const createNewContext = (
  chat: AiGroupChat,
  now: number,
  summary?: string
): AiGroupChatContext => {
  const ctx: AiGroupChatContext = {
    id: useSnowflake().nextId(),
    startedAt: now,
    lastActivityAt: now,
    summary
  }
  chat.contexts.push(ctx)
  chat.activeContextId = ctx.id
  return ctx
}

/** 压缩上下文：用 summary 开启新上下文（旧历史不再逐条注入） */
export const compressContext = (chat: AiGroupChat, summary: string, now: number): AiGroupChatContext =>
  createNewContext(chat, now, summary)

// ==========================================
//  记忆工具（按天）：作为每个成员 agent 的内置 tool
// ==========================================

const readMemoryFile = async (discussionId: string, date: string): Promise<AiGroupChatMemory> => {
  const path = buildMemoryPath(discussionId, date)
  if (!window.preload.fs.existsSync(path)) return { date, entries: [] }
  try {
    const text = await window.preload.fs.readTextFile(path)
    return JSON.parse(text) as AiGroupChatMemory
  } catch {
    return { date, entries: [] }
  }
}

const writeMemoryFile = async (discussionId: string, memory: AiGroupChatMemory): Promise<void> => {
  const folder = buildMemoryFolderPath(discussionId)
  if (!window.preload.fs.existsSync(folder)) await window.preload.fs.mkdir(folder)
  const path = buildMemoryPath(discussionId, memory.date)
  await enqueueByPath(path, () => window.preload.fs.writeTextFile(path, JSON.stringify(memory)))
}

export const buildMemoryTools = (discussionId: string): ToolFunction[] => [
  {
    name: 'read_memory',
    label: '读取记忆',
    description:
      '读取指定日期（默认今天）的按天记忆。返回当天记录的关键信息。当你需要回忆此前讨论中沉淀的结论、用户偏好或待办时使用。',
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: '日期，格式 YYYY-MM-DD。省略则读取今天。'
        }
      }
    },
    handler: async (...params: unknown[]) => {
      const { date } = (params[0] ?? {}) as { date?: string }
      const target = date?.trim() || formatDate(Date.now())
      const memory = await readMemoryFile(discussionId, target)
      if (memory.entries.length === 0) return { date: target, entries: [], note: '当天暂无记忆' }
      return memory
    }
  },
  {
    name: 'write_memory',
    label: '写入记忆',
    description:
      '把一条值得长期记住的信息写入指定日期（默认今天）的按天记忆。用于沉淀讨论结论、用户偏好、待办或重要事实，供日后 read_memory 召回。',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: '要记忆的内容，简洁明确。'
        },
        date: {
          type: 'string',
          description: '日期，格式 YYYY-MM-DD。省略则写入今天。'
        }
      },
      required: ['content']
    },
    handler: async (...params: unknown[]) => {
      const { content, date } = (params[0] ?? {}) as { content?: string; date?: string }
      if (!content?.trim()) return { error: 'content 不能为空' }
      const target = date?.trim() || formatDate(Date.now())
      const memory = await readMemoryFile(discussionId, target)
      memory.date = target
      memory.entries.push({ time: Date.now(), content: content.trim() })
      await writeMemoryFile(discussionId, memory)
      return { ok: true, date: target, count: memory.entries.length }
    }
  }
]

export { DEFAULT_CONTEXT_EXPIRY_HOURS }
