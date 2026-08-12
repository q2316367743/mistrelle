import { useAiAgentStore, useAiDiscussionStore } from '@/store'
import { DialogPlugin, Divider, Form, FormItem, Input, Select, Textarea } from 'tdesign-vue-next'
import type { FormInstanceFunctions } from 'tdesign-vue-next'
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'
import { useContextMenu } from '@/hooks'
import { DeleteIcon, EditIcon } from 'tdesign-icons-vue-next'
import {
  AiDiscussionForm,
  AiDiscussionModeOptions,
  AiDiscussionOrderTypeOptions,
  AiDiscussionSummaryTriggerOptions,
  buildAiDiscussionForm
} from '@/entity/ai'
import { discussionRecordRemoveAll } from '@/modules/discussion'

export const openDiscussionPut = async (id?: string, onSaved?: () => void) => {
  const { getById, put } = useAiDiscussionStore()
  const old = await getById(id)
  const form = ref<AiDiscussionForm>(old || buildAiDiscussionForm())

  const formRef = ref<FormInstanceFunctions | null>(null)

  const dp = DialogPlugin({
    header: (old ? '修改' : '新增') + '分组',
    placement: 'center',
    width: '640px',
    onConfirm: async () => {
      const result = await formRef.value?.validate?.()
      if (result !== true) return
      if (!form.value.roles.length) {
        MessageUtil.warning('请至少选择一个角色')
        return
      }
      put(form.value, id)
        .then(() => {
          MessageUtil.success('保存成功')
          dp.destroy()
          onSaved?.()
        })
        .catch((e) => {
          MessageUtil.error('保存失败', e)
        })
    },
    default: () => {
      const agentOptions = useAiAgentStore().options

      return (
        <div class={'p-4px'}>
          <Form ref={formRef} data={form.value}>
            <FormItem label={'群组名称'} name={'name'}>
              <Input v-model={form.value.name} placeholder={'请输入群组名称'} />
            </FormItem>
            <FormItem label={'群组描述'} name={'description'}>
              <Textarea
                v-model={form.value.description}
                placeholder={'请输入群组描述'}
                autosize={{ minRows: 2, maxRows: 4 }}
              />
            </FormItem>

            <FormItem label={'参与者角色'} name={'roles'}>
              <Select
                v-model={form.value.roles}
                options={agentOptions}
                placeholder={'请选择参与讨论的角色'}
                multiple={true}
                filterable={true}
                minCollapsedNum={2}
              />
            </FormItem>

            <Divider>会议配置</Divider>

            <FormItem label={'讨论模式'} name={'mode'}>
              <Select v-model={form.value.mode} options={AiDiscussionModeOptions} />
            </FormItem>
            {form.value.mode === 'rounds_limit' && (
              <FormItem label={'最大轮数'} name={'maxRounds'}>
                <Input v-model={form.value.maxRounds} type={'number'} />
              </FormItem>
            )}
            <FormItem label={'发言顺序'} name={'orderType'}>
              <Select v-model={form.value.orderType} options={AiDiscussionOrderTypeOptions} />
            </FormItem>
            <FormItem label={'总结触发'} name={'summaryTrigger'}>
              <Select
                v-model={form.value.summaryTrigger}
                options={AiDiscussionSummaryTriggerOptions}
              />
            </FormItem>
            <FormItem label={'总结者角色'}>
              <Select
                v-model={form.value.summaryRole}
                options={agentOptions}
                placeholder={'不设置'}
                clearable={true}
                filterable={true}
              />
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
        onClick: () => openDiscussionPut(id)
      },
      {
        icon: () => <DeleteIcon class={'color-red'} />,
        label: <span class={'color-red'}>删除</span>,
        onClick: () => {
          MessageBoxUtil.confirm(
            '确定要删除吗？会删除全部的讨论记录，数据不可恢复',
            '删除确认'
          ).then(() => {
            const store = useAiDiscussionStore()
            store
              .remove(id)
              .then(() => {
                discussionRecordRemoveAll(id)
                MessageUtil.success('删除成功')
              })
              .catch((e) => MessageUtil.error('删除失败', e))
          })
        }
      }
    ]
  })
}
