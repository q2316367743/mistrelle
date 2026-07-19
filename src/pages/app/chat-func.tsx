import { useContextMenu } from '@/hooks'
import { DeleteIcon, EditIcon } from 'tdesign-icons-vue-next'
import { useAiChatStore } from '@/store'
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'

/**
 * 打开会话右键菜单
 * @param e 鼠标事件
 * @param agentId 会话ID
 * @param id 消息ID
 * @param onUpdate 更新回调
 */
export const openChatContextmenu = (
  e: MouseEvent,
  agentId: string,
  id: string,
  onUpdate?: () => void
) => {
  useContextMenu(e, {
    items: [
      {
        icon: () => <EditIcon />,
        label: '重命名',
        onClick: () => {
          const store = useAiChatStore()
          store
            .rename(agentId, id)
            .then(() => {
              MessageUtil.success('重命名成功')
              onUpdate?.()
            })
            .catch((e) => {
              MessageUtil.error('重命名失败', e.message)
            })
        }
      },
      {
        icon: () => <DeleteIcon class={'color-red'} />,
        label: <span class={'color-red'}>删除</span>,
        onClick: () => {
          MessageBoxUtil.confirm('是否删除该会话？', '删除确认')
            .then(() => {
              const store = useAiChatStore()
              return store.remove(agentId, id)
            })
            .then(() => {
              MessageUtil.success('删除成功')
            })
        }
      }
    ]
  })
}
