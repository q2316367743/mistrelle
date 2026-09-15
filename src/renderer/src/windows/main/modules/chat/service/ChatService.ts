import { AiChatContent, AiChatItem } from '@/entity/ai'
import { getDataForWorkspace } from '@/global/Constant'
import type { ChatType, WritingScene } from '@/windows/main/modules/chat'
import type { DesignScene } from '@/windows/main/modules/chat/designScene'
import { resolveScene } from '@/windows/main/modules/chat/scenes'
import { cloneDeep } from 'es-toolkit'

// ==========================================
//  聊天持久化服务（SQLite）
//  storageKey 语义：chat:{chatId} / sub:{chatId}:{subId} 走 DB；
//  其余键（项目任务等文件路径）沿用文件读写（见 ProjectTaskService）
//  历史 index.json / message/*.json 由 test/migrate-chat-to-sqlite.mjs 手动迁移，业务代码不感知
// ==========================================

/** 聊天会话键（替代原 main.json 路径）：chat:{chatId} */
export const buildChatMainKey = (chatId: string): string => `chat:${chatId}`

/** 子代理会话键（替代原 sub_{subId}.json 路径）：sub:{chatId}:{subId} */
export const buildChatSubKey = (chatId: string, subId: string): string => `sub:${chatId}:${subId}`

const CHAT_KEY_PREFIX = 'chat:'
const SUB_KEY_PREFIX = 'sub:'

type ParsedKey =
  | { kind: 'chat'; id: string }
  | { kind: 'sub'; chatId: string; subId: string }

/** 解析 DB 键；非 chat:/sub: 前缀返回 null（视为文件路径键） */
const parseKey = (key: string): ParsedKey | null => {
  if (key.startsWith(CHAT_KEY_PREFIX)) return { kind: 'chat', id: key.slice(CHAT_KEY_PREFIX.length) }
  if (key.startsWith(SUB_KEY_PREFIX)) {
    const rest = key.slice(SUB_KEY_PREFIX.length)
    const sep = rest.indexOf(':')
    if (sep > 0) return { kind: 'sub', chatId: rest.slice(0, sep), subId: rest.slice(sep + 1) }
  }
  return null
}

/** chat 表行 → AiChatItem 映射（list / getItem 共用；top / privacy 0/1 转布尔） */
const toItem = (row: ChatItemRow): AiChatItem => ({
  id: row.id,
  name: row.name,
  top: row.top === 1,
  privacy: row.privacy === 1,
  workspace: row.workspace,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  ...(row.projectId ? { projectId: row.projectId } : {}),
  ...(row.taskId ? { taskId: row.taskId } : {}),
  ...(row.type ? { type: row.type as ChatType } : {})
})

/**
 * 获取聊天列表（类型化列，免整份 index.json 解析）
 */
export const aiChatList = async (): Promise<Array<AiChatItem>> => {
  const rows = await window.preload.db.chat.list()
  return rows.map(toItem)
}

/** 读取单个聊天行（隐私标记水合等轻量查询）；缺行返回 undefined */
export const aiChatGetItem = async (id: string): Promise<AiChatItem | undefined> => {
  const row = await window.preload.db.chat.getItem(id)
  return row ? toItem(row) : undefined
}

/** 从 storageKey 解析聊天 id（仅 chat:{id} 键），非聊天主键返回 null */
export const chatIdFromKey = (key: string): string | null =>
  key.startsWith(CHAT_KEY_PREFIX) ? key.slice(CHAT_KEY_PREFIX.length) : null

/** 列表行 upsert（新增 / 更名 / 置顶等） */
export const aiChatUpsertItem = async (item: AiChatItem): Promise<void> => {
  await window.preload.db.chat.upsertItem(cloneDeep(item))
}

/** 删除聊天：单事务级联删列表行 + 消息体 + 子代理消息体（沙盒产物目录由 aiChatSandboxRemove 处理） */
export const aiChatRemove = async (id: string): Promise<void> => {
  await window.preload.db.chat.deleteItem(id)
}

/**
 * 读取完整聊天内容（chat:/sub: 走 DB，其余键走文件）。
 * 缺行 / 文件不存在返回 undefined
 */
export const aiChatContentGet = async (key: string): Promise<AiChatContent | undefined> => {
  const parsed = parseKey(key)
  if (parsed?.kind === 'chat') {
    const row = await window.preload.db.chat.getContent(parsed.id)
    return row.data ? (JSON.parse(row.data) as AiChatContent) : undefined
  }
  if (parsed?.kind === 'sub') {
    const data = await window.preload.db.chat.getSub(parsed.chatId, parsed.subId)
    return data ? (JSON.parse(data) as AiChatContent) : undefined
  }
  if (!window.preload.fs.existsSync(key)) return undefined
  try {
    return JSON.parse(await window.preload.fs.readTextFile(key)) as AiChatContent
  } catch {
    return undefined
  }
}

/**
 * 写入完整聊天内容（chat://sub: 走 DB，其余键走文件）
 */
export const aiChatContentSet = async (key: string, content: AiChatContent): Promise<void> => {
  const parsed = parseKey(key)
  if (parsed?.kind === 'chat') {
    await window.preload.db.chat.setContent(parsed.id, JSON.stringify(content), content.updatedTime)
    return
  }
  if (parsed?.kind === 'sub') {
    await window.preload.db.chat.setSub(parsed.chatId, parsed.subId, JSON.stringify(content))
    return
  }
  await window.preload.fs.writeTextFile(key, JSON.stringify(content))
}

/** 消息体更新时间戳（记忆提取「未变跳过」依据，替代原文件 mtime）；非 chat 键返回 null */
export const aiChatContentStamp = async (key: string): Promise<number | null> => {
  const parsed = parseKey(key)
  if (parsed?.kind === 'chat') return window.preload.db.chat.getStamp(parsed.id)
  return null
}

/** 沙盒目录创建选项：按聊天类型预建专属目录结构 */
export interface ChatSandboxOptions {
  /** 聊天类型（家族）：场景专属目录清单取自场景定义的 sandboxDirs */
  type?: ChatType
  /** 写作子场景（writing 类型下默认 article，预留扩展） */
  writingScene?: WritingScene
  /** 设计子场景（design 类型下默认 canvas） */
  designScene?: DesignScene
}

// 创建此次聊天的沙盒目录（消息体已入 DB，无需 message/ 子目录）
export const aiChatSandbox = async (id: string, options: ChatSandboxOptions = {}) => {
  const folder = window.preload.path.join(getDataForWorkspace(), id)
  await window.preload.fs.mkdir(folder, true)
  const outputs = window.preload.path.join(folder, 'outputs')
  const inputs = window.preload.path.join(folder, 'inputs')
  const tmp = window.preload.path.join(folder, 'tmp')
  await Promise.all([
    window.preload.fs.mkdir(outputs),
    window.preload.fs.mkdir(inputs),
    window.preload.fs.mkdir(tmp)
  ])
  // 按场景预建专属项目目录（如 writing/article → articles/{drafts,assets}；writing/novelShort → novels/），
  // 目录清单来自场景定义的 sandboxDirs（相对沙盒根），通用 outputs/inputs/tmp 已在上面创建
  const scene = resolveScene(options.type ?? 'office', options.writingScene, options.designScene)
  await Promise.all(
    (scene.sandboxDirs?.() ?? []).map((dir) =>
      window.preload.fs.mkdir(window.preload.path.join(folder, dir), true)
    )
  )
}

export const getSandboxDir = (id: string) => window.preload.path.join(getDataForWorkspace(), id)

// 删除该聊天的沙盒目录（outputs/inputs/tmp 等产物文件）
export const aiChatSandboxRemove = async (id: string) => {
  const folder = getSandboxDir(id)
  if (window.preload.fs.existsSync(folder)) {
    await window.preload.fs.rm(folder)
  }
}
