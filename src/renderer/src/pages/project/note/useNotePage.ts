import {
  createFolder,
  createNote,
  deleteFolder,
  deleteNote,
  noteKeyDirAbs,
  noteRootPath,
  readNote,
  readNoteTree,
  renameFolder,
  renameNote,
  writeNote,
  type NoteNode
} from '@/modules/note'
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'
import type { Ref } from 'vue'

const SAVE_DEBOUNCE = 800

/** 已打开的笔记页签：正文与脏标记按 tab 独立维护，切换不丢未保存内容 */
export interface NoteTab {
  /** 笔记 key（相对笔记库根，不含 .md） */
  key: string
  /** 笔记名（展示用） */
  name: string
  content: string
  dirty: boolean
}

/**
 * 项目笔记页状态编排：笔记库树 / 打开的 tab 集 / 当前激活 tab。
 * 数据根目录为 ~/.mistrelle/project/{projectId}/notes，随 projectId 切换自动
 * 落盘旧项目 tab 并重置（路由复用组件实例，需 watch 处理）。
 * 编辑改动经 800ms 防抖落盘；关闭、重命名、删除前先 flush 对应 tab，
 * 避免读到旧版本正文或丢失未保存内容（重命名依赖源文件内容改写引用）。
 */
export const useNotePage = (projectId: Ref<string>) => {
  const root = computed(() => noteRootPath(projectId.value))
  const tree = ref<NoteNode[]>([])
  const tabs = ref<NoteTab[]>([])
  const activeKey = ref<string | null>(null)

  const activeTab = computed<NoteTab | undefined>(() =>
    tabs.value.find((t) => t.key === activeKey.value)
  )
  const baseDir = computed(() =>
    activeTab.value ? noteKeyDirAbs(root.value, activeTab.value.key) : ''
  )

  /** t-tabs v-model 兼容：无激活时映射为空串（此时 tab 条不渲染） */
  const activeTabValue = computed<string>({
    get: () => activeKey.value ?? '',
    set: (value: string) => {
      activeKey.value = value
    }
  })

  let saveTimer: ReturnType<typeof setTimeout> | null = null

  const basename = (key: string): string => key.split('/').pop() ?? ''

  const reload = async () => {
    tree.value = await readNoteTree(root.value)
  }

  const cancelSave = () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
  }

  /** 立即落盘指定 tab 的未保存内容（幂等；写入失败恢复脏标记避免静默丢失） */
  const flushOne = async (rootPath: string, key: string): Promise<void> => {
    const tab = tabs.value.find((t) => t.key === key)
    if (!tab || !tab.dirty) return
    tab.dirty = false
    try {
      await writeNote(rootPath, key, tab.content)
    } catch {
      tab.dirty = true
    }
  }

  /** 落盘全部脏 tab（rootPath 显式传入，切换项目时使用旧 root） */
  const flushAll = async (rootPath: string): Promise<void> => {
    cancelSave()
    await Promise.all(tabs.value.map((t) => flushOne(rootPath, t.key)))
  }

  /** 关闭 tab 后激活相邻 tab */
  const activateNeighbor = (removedIndex: number) => {
    const next = tabs.value[removedIndex] ?? tabs.value[removedIndex - 1]
    activeKey.value = next?.key ?? null
  }

  const handleChange = (value: string) => {
    const tab = activeTab.value
    if (!tab) return
    tab.content = value
    tab.dirty = true
    const targetRoot = root.value
    cancelSave()
    saveTimer = setTimeout(() => {
      void flushOne(targetRoot, tab.key)
    }, SAVE_DEBOUNCE)
  }

  const load = async () => {
    await reload()
  }

  /** 打开笔记：已开则激活对应 tab，未开则读取并新建 tab */
  const open = async (key: string) => {
    if (tabs.value.some((t) => t.key === key)) {
      activeKey.value = key
      return
    }
    try {
      const content = await readNote(root.value, key)
      tabs.value.push({ key, name: basename(key), content, dirty: false })
      activeKey.value = key
    } catch {
      MessageUtil.error('打开笔记失败', key)
    }
  }

  /** 关闭 tab：落盘后移除并激活相邻 tab */
  const close = async (key: string) => {
    const index = tabs.value.findIndex((t) => t.key === key)
    if (index < 0) return
    cancelSave()
    await flushOne(root.value, key)
    tabs.value.splice(index, 1)
    if (activeKey.value === key) activateNeighbor(index)
  }

  /** 新建笔记 / 文件夹（parentKey 为相对根目录路径，根为 ''） */
  const create = async (kind: 'note' | 'folder', parentKey: string, name: string) => {
    try {
      if (kind === 'note') {
        const note = await createNote(root.value, name, parentKey)
        await reload()
        const content = await readNote(root.value, note.key)
        tabs.value.push({ key: note.key, name: note.name, content, dirty: false })
        activeKey.value = note.key
      } else {
        await createFolder(root.value, name, parentKey)
        await reload()
      }
    } catch (e) {
      MessageUtil.error(kind === 'note' ? '新建笔记失败' : '新建文件夹失败', e)
    }
  }

  /** 重命名笔记 / 文件夹，并同步已打开 tab */
  const rename = async (kind: 'note' | 'folder', node: NoteNode, newName: string) => {
    if (kind === 'note') {
      cancelSave()
      await flushOne(root.value, node.key)
      try {
        await renameNote(root.value, node.key, newName)
        await reload()
        const newKey = `${node.parentKey ? `${node.parentKey}/` : ''}${newName}`
        const tab = tabs.value.find((t) => t.key === node.key)
        if (tab) {
          tab.key = newKey
          tab.name = newName
          // 重命名已改写磁盘正文引用，重新载入让编辑器显示更新后的相对路径
          tab.content = await readNote(root.value, newKey)
          tab.dirty = false
        }
        if (activeKey.value === node.key) activeKey.value = newKey
      } catch (e) {
        MessageUtil.error('重命名失败', e)
      }
    } else {
      cancelSave()
      try {
        await renameFolder(root.value, node.key, newName)
        await reload()
        const newRel = `${node.parentKey ? `${node.parentKey}/` : ''}${newName}`
        const prefix = `${node.key}/`
        for (const tab of tabs.value) {
          if (tab.key.startsWith(prefix)) {
            tab.key = newRel + tab.key.slice(prefix.length)
          }
        }
        if (activeKey.value && activeKey.value.startsWith(prefix)) {
          activeKey.value = newRel + activeKey.value.slice(prefix.length)
        }
      } catch (e) {
        MessageUtil.error('重命名失败', e)
      }
    }
  }

  /** 删除笔记 / 文件夹，并移除相关 tab */
  const remove = async (kind: 'note' | 'folder', node: NoteNode) => {
    const label = kind === 'folder' ? '文件夹' : '笔记'
    const content =
      kind === 'folder'
        ? `确定删除文件夹「${node.name}」吗？其中所有笔记与附件将一并删除。`
        : `确定删除笔记「${node.name}」吗？附件目录将一并删除。`
    try {
      await MessageBoxUtil.confirm(content, `删除${label}`)
    } catch {
      return
    }
    cancelSave()
    try {
      if (kind === 'note') {
        await flushOne(root.value, node.key)
        await deleteNote(root.value, node.key)
        await reload()
        const index = tabs.value.findIndex((t) => t.key === node.key)
        if (index >= 0) {
          tabs.value.splice(index, 1)
          if (activeKey.value === node.key) activateNeighbor(index)
        }
      } else {
        const prefix = `${node.key}/`
        await Promise.all(
          tabs.value.filter((t) => t.key.startsWith(prefix)).map((t) => flushOne(root.value, t.key))
        )
        await deleteFolder(root.value, node.key)
        await reload()
        const activeIndex = tabs.value.findIndex((t) => t.key === activeKey.value)
        tabs.value = tabs.value.filter((t) => !t.key.startsWith(prefix))
        if (activeKey.value && activeKey.value.startsWith(prefix)) {
          activeKey.value = tabs.value[activeIndex]?.key ?? tabs.value[activeIndex - 1]?.key ?? null
        }
      }
    } catch (e) {
      MessageUtil.error('删除失败', e)
    }
  }

  /** 重命名弹窗的冲突名集合：目标条目所在父目录下的同级条目名（不含自身） */
  const siblingNames = (node: NoteNode): string[] => {
    if (!node.parentKey) {
      return tree.value.filter((n) => n.key !== node.key).map((n) => n.name)
    }
    const parent = findNode(tree.value, node.parentKey)
    const children = parent?.children ?? []
    return children.filter((c) => c.key !== node.key).map((c) => c.name)
  }

  /** 切换项目：先落盘旧项目未保存内容，再清空 tab 并重载新项目树 */
  watch(
    () => root.value,
    async (newRoot, oldRoot) => {
      if (!oldRoot || newRoot === oldRoot) return
      await flushAll(oldRoot)
      tabs.value = []
      activeKey.value = null
      await reload()
    }
  )

  onBeforeUnmount(() => {
    void flushAll(root.value)
  })

  return {
    tree,
    tabs,
    activeKey,
    activeTab,
    activeTabValue,
    baseDir,
    root,
    handleChange,
    load,
    open,
    close,
    create,
    rename,
    remove,
    siblingNames
  }
}

/** 在树中按 key 查找节点 */
const findNode = (nodes: NoteNode[], key: string): NoteNode | undefined => {
  for (const node of nodes) {
    if (node.key === key) return node
    if (node.children) {
      const found = findNode(node.children, key)
      if (found) return found
    }
  }
  return undefined
}
