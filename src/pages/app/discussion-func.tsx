import { useAiDiscussionStore, useSettingAiStore } from '@/store'
import { DialogPlugin, Form, FormItem, Input, Select, Switch, Textarea } from 'tdesign-vue-next'
import { MessageUtil } from '@/utils/modal'
import { useContextMenu } from '@/hooks'
import { DeleteIcon, EditIcon } from 'tdesign-icons-vue-next'
import { AiDiscussionForm, buildAiDiscussionForm } from '@/entity/ai/AiDiscussion'

export const openDiscussionPut = async (id?: string) => {
  const { getById, put } = useAiDiscussionStore()
  const { options } = useSettingAiStore()
  const old = await getById(id)
  const form = ref<AiDiscussionForm>(old || buildAiDiscussionForm())

  const dp = DialogPlugin({
    header: (old ? '修改' : '新增') + '分组',
    placement: 'center',
    width: '80vw',
    onConfirm: () => {
      put(form.value)
        .then(() => {
          MessageUtil.success('保存成功')
          dp.destroy()
        })
        .catch((e) => {
          MessageUtil.error('保存失败', e)
        })
    },
    default: () => {
      return (
        <div style={{ height: 'calc(100vh - 280px)', overflow: 'auto' }}>
          <Form data={form.value}>
            <FormItem label={'分组名称'} name={'name'}>
              <Input v-model={form.value.name} placeholder={'请输入分组名称'} />
            </FormItem>
          </Form>
        </div>
      )
    }
  })
}

export const openDiscussionContextmenu = (e: MouseEvent, id: string) => {
  useContextMenu(e, {
    items: [
      {
        icon: () => <EditIcon />,
        label: '编辑',
        onClick: () => {}
      },
      {
        icon: () => <DeleteIcon class={'color-red'} />,
        label: <span class={'color-red'}>删除</span>,
        onClick: () => {}
      }
    ]
  })
}
