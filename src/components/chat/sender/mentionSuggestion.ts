import { PluginKey } from '@tiptap/pm/state'
import type { SuggestionOptions } from '@tiptap/suggestion'
import type { Ref } from 'vue'
import type { ChatFileRef, WorkspaceEntryRef } from '@/utils/chatSender'
import { listWorkspaceEntries } from '@/utils/chatSender'
import { makeSuggestionRenderer, type SuggestionRendererOptions } from '@/utils/suggestionRenderer'
import type { LocalSkill } from '@/modules/skill'
import { toolOptions } from '@/modules/tool'

// 导出的稳定 PluginKey，供 LChatSender 在 keydown 时直接读取 suggestion 内部 active 状态，
// 避免使用易失同步的外部标志（suggestionOpen）导致回车误触发发送。
export const skillMentionPluginKey = new PluginKey('skillMention')
export const fileMentionPluginKey = new PluginKey('fileMention')
export const toolMentionPluginKey = new PluginKey('toolMention')

export interface SkillSuggestionItem {
  id: string
  label: string
  data: LocalSkill
}

export const buildSkillSuggestion = (
  skills: Ref<LocalSkill[]>,
  options?: SuggestionRendererOptions
): Partial<SuggestionOptions<SkillSuggestionItem>> => ({
  char: '/',
  pluginKey: skillMentionPluginKey,
  items: ({ query }) =>
    skills.value
      .filter((s) =>
        `${s.name} ${s.dirName} ${s.description}`.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 8)
      .map<SkillSuggestionItem>((s) => ({ id: s.path, label: s.name, data: s })),
  command: ({ editor, range, props }) => {
    editor
      .chain()
      .focus()
      .insertContentAt(range, [
        { type: 'skillMention', attrs: { id: props.id, label: props.label } },
        { type: 'text', text: ' ' }
      ])
      .run()
  },
  render: makeSuggestionRenderer(
    (item) => {
      const s = item as SkillSuggestionItem
      return { title: s.label, desc: s.data.description }
    },
    options
  )
})

export interface FileSuggestionItem {
  id: string
  label: string
  data: ChatFileRef & { isDirectory?: boolean }
}

export interface FileSuggestionOptions extends SuggestionRendererOptions {
  /** 工作空间根目录，为空时不参与 @ 提名 */
  workspace: Readonly<Ref<string>>
}

const toFileSuggestionItem = (f: ChatFileRef): FileSuggestionItem => ({
  id: f.path,
  label: f.relativePath,
  data: f
})

const toWorkspaceSuggestionItem = (entry: WorkspaceEntryRef): FileSuggestionItem => ({
  id: entry.path,
  label: entry.relativePath,
  data: entry
})

export const buildFileSuggestion = (
  files: Readonly<Ref<ChatFileRef[]>>,
  options?: Partial<FileSuggestionOptions>
): Partial<SuggestionOptions<FileSuggestionItem>> => ({
  char: '@',
  pluginKey: fileMentionPluginKey,
  // 轻微防抖，避免快速输入时反复触发目录读盘
  debounce: 80,
  items: async ({ query }) => {
    const workspace = options?.workspace?.value || ''
    if (!query) {
      // 空查询：工作空间根直接子项(目录在前) + 沙盒文件 + 项目文件
      const list: FileSuggestionItem[] = []
      if (workspace) {
        const entries = await listWorkspaceEntries(workspace, '')
        list.push(...entries.map(toWorkspaceSuggestionItem))
      }
      list.push(...files.value.map(toFileSuggestionItem))
      return list.slice(0, 8)
    }
    if (!workspace) {
      // 未选择工作空间时回退到旧的全量模糊过滤
      return files.value
        .filter((f) => f.relativePath.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8)
        .map(toFileSuggestionItem)
    }
    // 非空查询：在工作空间内按「一级一层」路径下钻
    const entries = await listWorkspaceEntries(workspace, query)
    return entries.map(toWorkspaceSuggestionItem).slice(0, 8)
  },
  command: ({ editor, range, props }) => {
    // 目录：把查询文本替换为「目录相对路径 + /」并保留 @ 触发符，
    // suggestion 插件会在下一次事务中按新 query 重新拉取并续开弹层，实现逐级下钻。
    if (props.data?.isDirectory) {
      editor
        .chain()
        .focus()
        .insertContentAt(
          { from: range.from + 1, to: range.to },
          { type: 'text', text: `${props.label}/` }
        )
        .run()
      return
    }
    editor
      .chain()
      .focus()
      .insertContentAt(range, [
        { type: 'fileMention', attrs: { id: props.id, label: props.label } },
        { type: 'text', text: ' ' }
      ])
      .run()
  },
  render: makeSuggestionRenderer(
    (item) => {
      const f = item as FileSuggestionItem
      if (f.data.isDirectory) return { title: `${f.label}/`, desc: '目录' }
      return { title: f.label, desc: f.data.path }
    },
    options
  )
})

export interface ToolSuggestionItem {
  id: string
  label: string
  group: string
}

const allToolSuggestionItems = (): ToolSuggestionItem[] =>
  toolOptions.flatMap((group) =>
    group.children.map((tool) => ({
      id: String(tool.value),
      label: String(tool.label),
      group: group.group
    }))
  )

export const buildToolSuggestion = (
  options?: SuggestionRendererOptions
): Partial<SuggestionOptions<ToolSuggestionItem>> => ({
  char: '#',
  pluginKey: toolMentionPluginKey,
  items: ({ query }) =>
    allToolSuggestionItems()
      .filter((tool) =>
        `${tool.label} ${tool.id} ${tool.group}`.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 8),
  command: ({ editor, range, props }) => {
    editor
      .chain()
      .focus()
      .insertContentAt(range, [
        { type: 'toolMention', attrs: { id: props.id, label: props.label } },
        { type: 'text', text: ' ' }
      ])
      .run()
  },
  render: makeSuggestionRenderer(
    (item) => {
      const tool = item as ToolSuggestionItem
      return { title: tool.label, desc: `${tool.group} · ${tool.id}` }
    },
    options
  )
})
