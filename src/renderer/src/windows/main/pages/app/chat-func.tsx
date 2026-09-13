import { useContextMenu } from '@/hooks'
import { DeleteIcon, EditIcon } from 'tdesign-icons-vue-next'
import { useAiChatStore } from '@/windows/main/store'
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'
import { AiChatItem } from '@/entity/ai'
import { useWorkspaceList } from '@/components/chat/useWorkspaceList'

/**
 * 打开会话右键菜单
 * @param e 鼠标事件
 * @param chat 会话
 * @param onUpdate 更新回调
 */
export const openChatContextmenu = (e: MouseEvent, chat: AiChatItem, onUpdate: () => void) => {
  useContextMenu(e, {
    items: [
      {
        icon: () => <EditIcon />,
        label: '重命名',
        onClick: () => {
          MessageBoxUtil.prompt('请输入新的会话名称', '重命名会话', {
            inputValue: chat.name
          }).then((name) => {
            useAiChatStore()
              .rename(chat.id, name)
              .then(() => {
                MessageUtil.success('重命名成功')
              })
              .catch((e) => {
                MessageUtil.error('重命名失败', e.message)
              })
          })
        }
      },
      {
        icon: () => <DeleteIcon class={'color-red'} />,
        label: <span class={'color-red'}>删除</span>,
        onClick: () => {
          MessageBoxUtil.confirm('是否删除该会话？', '删除确认').then(() => {
            useAiChatStore()
              .remove(chat.id)
              .then(() => {
                MessageUtil.success('删除成功')
                onUpdate()
              })
              .catch((e) => MessageUtil.error('删除失败', e))
              .finally(() => onUpdate?.())
          })
        }
      }
    ]
  })
}

/**
 * 打开工作空间分组头右键菜单：重命名只改显示别名（目录路径与磁盘目录不动），删除连同其下聊天级联删除
 * @param e 鼠标事件
 * @param workspace 工作目录全路径（任务列表无目录不响应）
 */
export const openWorkspaceContextmenu = (e: MouseEvent, workspace: string) => {
  if (!workspace) return
  const { displayName, renameWorkspace, countChats, removeWorkspace } = useWorkspaceList()
  useContextMenu(e, {
    items: [
      {
        icon: () => <EditIcon />,
        label: '重命名',
        onClick: () => {
          MessageBoxUtil.prompt('请输入新的显示名称（留空恢复目录名）', '重命名工作空间', {
            inputValue: displayName(workspace)
          })
            .then((name) => {
              renameWorkspace(workspace, name)
              MessageUtil.success('重命名成功')
            })
            .catch(() => {})
        }
      },
      {
        icon: () => <DeleteIcon class={'color-red'} />,
        label: <span class={'color-red'}>删除</span>,
        onClick: () => {
          const count = countChats(workspace)
          MessageBoxUtil.confirm(
            count > 0
              ? `将同时删除「${displayName(workspace)}」下的 ${count} 个聊天及其产物，删除后不可恢复`
              : `确定删除工作空间「${displayName(workspace)}」？`,
            '删除工作空间'
          )
            .then(async () => {
              await removeWorkspace(workspace)
              MessageUtil.success(count > 0 ? '工作空间及其聊天已删除' : '删除成功')
            })
            .catch(() => {})
        }
      }
    ]
  })
}
