import { computed, ref } from 'vue'
import { readJsonFile, writeJsonFile } from '@/utils/native'
import { KeyValueUtil } from '@/utils/native/KeyValueUtil'
import { getWorkspaceHistoryPath } from '@/global/Constant'
import { useAiChatStore } from '@/windows/main/store'

/** 模块级单例：目录历史 + 合并后的工作空间全集，多消费方共享同一状态 */
const history = ref(new Array<string>())
let loaded = false

const ensureLoaded = () => {
  if (loaded) return
  loaded = true
  readJsonFile<Array<string>>(getWorkspaceHistoryPath()).then((list) => {
    if (list) history.value = list
  })
  const stored = KeyValueUtil.getItem<unknown>(ALIAS_STORAGE_KEY)
  if (isStringRecord(stored)) aliases.value = stored
}

/** 别名持久化键：workspace 全路径 → 显示别名（无别名时展示目录 basename） */
const ALIAS_STORAGE_KEY = 'workspace-aliases'

const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every((item) => typeof item === 'string')

const aliases = ref<Record<string, string>>({})

const isBasename = (path: string, name: string) => window.preload.path.basename(path) === name

/**
 * 工作空间共享数据源：合并「聊天绑定的目录」与「最近目录历史」，
 * 供左侧聊天列表分组与 AiWorkspace 面板消费，保证两侧列表一致。
 */
export const useWorkspaceList = () => {
  ensureLoaded()

  /** 合并排序后的工作空间全集：有聊天绑定的在前（按组内最近聊天降序），仅历史中的在后（按最近使用优先） */
  const workspaces = computed(() => {
    const latest = new Map<string, number>()
    for (const chat of useAiChatStore().state) {
      if (!chat.workspace) continue
      const prev = latest.get(chat.workspace)
      if (prev === undefined || chat.createdAt > prev) latest.set(chat.workspace, chat.createdAt)
    }
    const chatWorkspaces = [...latest.keys()].sort(
      (a, b) => (latest.get(b) ?? 0) - (latest.get(a) ?? 0)
    )
    const historyOnly = history.value.filter((path) => !latest.has(path)).reverse()
    return [...chatWorkspaces, ...historyOnly]
  })

  /** 展示名：别名优先，缺省用目录 basename */
  const displayName = (path: string) => aliases.value[path] || window.preload.path.basename(path)

  /** 重命名工作空间显示别名（目录路径不变）；空串或与目录名相同即恢复默认 */
  const renameWorkspace = (path: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed || isBasename(path, trimmed)) delete aliases.value[path]
    else aliases.value[path] = trimmed
    KeyValueUtil.setItem(ALIAS_STORAGE_KEY, { ...aliases.value })
  }

  /** 记录最近使用的目录（去重追加并落盘） */
  const addHistory = async (path: string) => {
    if (!path || history.value.includes(path)) return
    history.value.push(path)
    await writeJsonFile(getWorkspaceHistoryPath(), history.value)
  }

  /** 从最近目录历史中移除条目并落盘 */
  const removeHistory = async (path: string) => {
    const index = history.value.indexOf(path)
    if (index < 0) return
    history.value.splice(index, 1)
    await writeJsonFile(getWorkspaceHistoryPath(), history.value)
  }

  /** 某工作空间下绑定的聊天数（删除确认提示用） */
  const countChats = (path: string) =>
    useAiChatStore().state.filter((chat) => chat.workspace === path).length

  /** 删除工作空间：删除其下全部聊天（会话/沙盒/产物由 AiChatStore.remove 级联处理）+ 历史条目 + 别名 */
  const removeWorkspace = async (path: string) => {
    const store = useAiChatStore()
    const ids = store.state.filter((chat) => chat.workspace === path).map((chat) => chat.id)
    for (const id of ids) await store.remove(id)
    await removeHistory(path)
    if (aliases.value[path]) {
      delete aliases.value[path]
      KeyValueUtil.setItem(ALIAS_STORAGE_KEY, { ...aliases.value })
    }
  }

  return {
    history,
    workspaces,
    displayName,
    renameWorkspace,
    addHistory,
    removeHistory,
    countChats,
    removeWorkspace
  }
}
