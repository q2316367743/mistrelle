import type { AiChatItem } from '@/entity/ai'
import { useAiChatStore } from '@/windows/main/store'
import { useWorkspaceList } from '@/components/chat/useWorkspaceList'
import { KeyValueUtil } from '@/utils/native/KeyValueUtil'
import { computed, reactive } from 'vue'

/** 任务列表分组 key：未绑定工作目录的聊天 */
export const TASK_GROUP_KEY = ''

/** 折叠分组 key 集合的 localStorage 键（key = workspace 全路径，任务组为空串） */
const COLLAPSED_STORAGE_KEY = 'chat-list-collapsed-groups'

interface ChatGroup {
  key: string
  /** 绑定的工作目录，空串即任务列表 */
  workspace: string
  /** 分组名：任务列表固定文案，项目取目录 basename */
  name: string
  chats: AiChatItem[]
}

export interface ChatGroupHeaderRow {
  kind: 'header'
  key: string
  name: string
  workspace: string
  collapsed: boolean
}

export interface ChatItemRow {
  kind: 'chat'
  chat: AiChatItem
}

export type ChatListRow = ChatGroupHeaderRow | ChatItemRow

const byCreatedDesc = (a: AiChatItem, b: AiChatItem) => b.createdAt - a.createdAt

/**
 * 聊天列表项目分组：按聊天绑定的 workspace（工作目录，创建时锁定）聚合，
 * 未绑定的归入「任务列表」并置顶，项目分组按组内最近聊天时间降序。
 */
export const useChatGroups = () => {
  // 折叠状态持久化：localStorage 存 key 数组，防历史脏数据按字符串数组收敛
  const stored = KeyValueUtil.getItem<unknown>(COLLAPSED_STORAGE_KEY)
  const collapsed = reactive(
    new Set(
      Array.isArray(stored) ? stored.filter((key): key is string => typeof key === 'string') : []
    )
  )

  const groups = computed<ChatGroup[]>(() => {
    const sorted = [...useAiChatStore().state].sort(byCreatedDesc)
    const tasks: AiChatItem[] = []
    const projects = new Map<string, AiChatItem[]>()
    for (const chat of sorted) {
      if (!chat.workspace) {
        tasks.push(chat)
        continue
      }
      const bucket = projects.get(chat.workspace)
      if (bucket) bucket.push(chat)
      else projects.set(chat.workspace, [chat])
    }
    // 项目分组以合并后的工作空间全集为序（有聊天绑定的按最近活跃在前，
    // 无聊天绑定的空分组置底），与 AiWorkspace 面板列表保持一致
    const { workspaces, displayName } = useWorkspaceList()
    return [
      { key: TASK_GROUP_KEY, workspace: '', name: '任务列表', chats: tasks },
      ...workspaces.value.map((workspace) => ({
        key: workspace,
        workspace,
        name: displayName(workspace),
        chats: projects.get(workspace) ?? []
      }))
    ]
  })

  const toggleGroup = (key: string) => {
    if (collapsed.has(key)) collapsed.delete(key)
    else collapsed.add(key)
    KeyValueUtil.setItem(COLLAPSED_STORAGE_KEY, [...collapsed])
  }

  /** 组（header + 聊天行）拍平为虚拟列表行；折叠组只保留 header，任务列表与工作空间全集均为空时不渲染 */
  const rows = computed<ChatListRow[]>(() => {
    if (groups.value.length === 1 && groups.value[0].chats.length === 0) return []
    return groups.value.flatMap((group) => {
      const header: ChatGroupHeaderRow = {
        kind: 'header',
        key: group.key,
        name: group.name,
        workspace: group.workspace,
        collapsed: collapsed.has(group.key)
      }
      if (header.collapsed) return [header]
      return [header, ...group.chats.map((chat): ChatItemRow => ({ kind: 'chat', chat }))]
    })
  })

  return { rows, toggleGroup }
}
