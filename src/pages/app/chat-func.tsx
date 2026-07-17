import { useContextMenu } from '@/hooks'
import { DeleteIcon } from 'tdesign-icons-vue-next'
import { useAiChatStore } from '@/store'
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'

export const openChatContextmenu = (e: MouseEvent, agentId: string, id: string) => {
  useContextMenu(e, {
    items: [
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
