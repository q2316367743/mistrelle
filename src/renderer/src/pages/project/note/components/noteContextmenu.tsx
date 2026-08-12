import type { NoteNode } from '@/modules/note'
import { useContextMenu } from '@/hooks'
import { DeleteIcon, EditIcon, FileAddIcon, FolderAddIcon } from 'tdesign-icons-vue-next'

export interface NoteMenuHandlers {
  createNote?: () => void
  createFolder?: () => void
  rename?: () => void
  delete?: () => void
}

/** 笔记库根目录空白区右键菜单：新增笔记 / 新增文件夹 */
export const openRootContextmenu = (e: MouseEvent, handlers: NoteMenuHandlers) => {
  useContextMenu(e, {
    items: [
      {
        icon: () => <FileAddIcon />,
        label: '新增笔记',
        onClick: () => handlers.createNote?.()
      },
      {
        icon: () => <FolderAddIcon />,
        label: '新增文件夹',
        onClick: () => handlers.createFolder?.()
      }
    ]
  })
}

/** 文件夹 / 笔记节点右键菜单 */
export const openNodeContextmenu = (e: MouseEvent, node: NoteNode, handlers: NoteMenuHandlers) => {
  if (node.type === 'folder') {
    useContextMenu(e, {
      items: [
        {
          icon: () => <FileAddIcon />,
          label: '新增笔记',
          onClick: () => handlers.createNote?.()
        },
        {
          icon: () => <FolderAddIcon />,
          label: '新增文件夹',
          onClick: () => handlers.createFolder?.()
        },
        {
          divided: 'down',
          icon: () => <EditIcon />,
          label: '重命名',
          onClick: () => handlers.rename?.()
        },
        {
          icon: () => <DeleteIcon class="color-red" />,
          label: <span class="color-red">删除</span>,
          onClick: () => handlers.delete?.()
        }
      ]
    })
    return
  }
  useContextMenu(e, {
    items: [
      {
        icon: () => <EditIcon />,
        label: '重命名',
        onClick: () => handlers.rename?.()
      },
      {
        icon: () => <DeleteIcon class="color-red" />,
        label: <span class="color-red">删除</span>,
        onClick: () => handlers.delete?.()
      }
    ]
  })
}
