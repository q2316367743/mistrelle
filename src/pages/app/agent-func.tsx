import { AiGroupForm, buildAiGroupForm } from '@/entity/ai'
import { useAiFriendStore, useAiAgentStore, useSettingAiStore } from '@/store'
import { toolOptions } from '@/modules/tool'
import { DialogPlugin, Form, FormItem, Input, Select, Switch, Textarea } from 'tdesign-vue-next'
import { MessageUtil } from '@/utils/modal'
import { useContextMenu } from '@/hooks'
import { DeleteIcon, EditIcon } from 'tdesign-icons-vue-next'

export const openAgentPut = (id?: string) => {
  const { getById, put } = useAiAgentStore()
  const old = getById(id)
  const form = ref<AiGroupForm>(old || buildAiGroupForm())

  const aiFriendStore = useAiFriendStore()
  const selectedFriendId = ref<string>('')
  const onFriendSelect = async (v: string) => {
    if (!v) return
    const friend = await aiFriendStore.getById(v)
    if (!friend) return
    form.value = {
      ...form.value,
      name: friend.name,
      prompt: friend.prompt,
      tools: [...friend.tools],
      model: friend.model,
      placeholder: friend.placeholder,
      think: friend.think
    }
  }

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
      const modelOptions = useSettingAiStore().options
      return (
        <div style={{ height: 'calc(100vh - 280px)', overflow: 'auto' }}>
          <Form data={form.value}>
            <FormItem label={'从好友填充'}>
              <Select
                v-model={selectedFriendId.value}
                options={aiFriendStore.state.map((f) => ({ label: f.name, value: f.id }))}
                placeholder={'选择好友快速填充'}
                clearable={true}
                onChange={(v) => onFriendSelect(v as string)}
              />
            </FormItem>
            <FormItem label={'分组名称'} name={'name'}>
              <Input v-model={form.value.name} placeholder={'请输入分组名称'} />
            </FormItem>
            <FormItem label={'系统提示词'} name={'prompt'}>
              <Textarea
                v-model={form.value.prompt}
                placeholder={'请输入系统提示词'}
                autosize={{ minRows: 3, maxRows: 10 }}
              />
            </FormItem>
            <FormItem label={'默认模型'} name={'model'}>
              <Select
                v-model={form.value.model}
                options={modelOptions}
                placeholder={'请选择默认模型'}
                clearable={true}
              />
            </FormItem>
            <FormItem label={'占位文案'} name={'placeholder'}>
              <Input v-model={form.value.placeholder} placeholder={'请输入输入框占位文案'} />
            </FormItem>
            <FormItem label={'启用思考'} name={'think'}>
              <Switch v-model={form.value.think} />
            </FormItem>
            <FormItem label={'启用工具'} name={'tools'}>
              <Select
                v-model={form.value.tools}
                options={toolOptions}
                placeholder={'请选择分组启用的工具'}
                multiple={true}
                filterable={true}
              />
            </FormItem>
          </Form>
        </div>
      )
    }
  })
}

export const openAgentContextmenu = (e: MouseEvent, id: string) => {
  useContextMenu(e, {
    items: [
      {
        icon: () => <EditIcon />,
        label: '编辑',
        onClick: () => openAgentPut(id)
      },
      {
        icon: () => <DeleteIcon class={'color-red'} />,
        label: <span class={'color-red'}>删除</span>,
        onClick: () => {}
      }
    ]
  })
}
