import { ProjectPlan } from '@/entity'
import { useContextMenu } from '@/hooks'
import {
  ChatAddIcon,
  DeleteIcon,
  EditIcon,
  File1Icon,
  InfoCircleIcon
} from 'tdesign-icons-vue-next'

export const usePlanContextmenu = (e: MouseEvent, event: {
  addTask: () => void,
  viewDetail: () => void,
  editPlan: () => void,
  deletePlan: () => void,
  viewAttachments: () => void
}) => {
  useContextMenu(e, {
    items: [
      {
        icon: () => <ChatAddIcon />,
        label: '添加到任务',
        onClick: () => event.addTask()
      },
      {
        icon: () => <InfoCircleIcon />,
        label: '查看详情',
        onClick: () => event.viewDetail()
      },
      {
        icon: () => <File1Icon />,
        label: '查看附件',
        divided: 'down',
        onClick: () => event.viewAttachments()
      },
      {
        icon: () => <EditIcon />,
        label: '编辑',
        onClick: () => event.editPlan()
      },
      {
        icon: () => <DeleteIcon class={'color-red'} />,
        label: <span class={'color-red'}>删除</span>,
        onClick: () => event.deletePlan()
      }
    ]
  })
}
