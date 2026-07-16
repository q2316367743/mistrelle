import { AiFriendForm, buildAiFriendForm, AiFriendType } from '@/entity/ai'
import { useAiFriendStore, useSettingAiStore } from '@/store'
import { toolOptions } from '@/modules/tool'
import { DialogPlugin, Form, FormItem, Input, Select, Switch, Textarea } from 'tdesign-vue-next'
import { MessageUtil, MessageBoxUtil } from '@/utils/modal'
import { useContextMenu } from '@/hooks'
import { DeleteIcon, EditIcon } from 'tdesign-icons-vue-next'

export const typeOptions: { label: string; value: AiFriendType }[] = [
  { label: '职业', value: 'profession' },
  { label: '伙伴', value: 'companion' },
  { label: '名人', value: 'celebrity' },
  { label: '其他', value: 'other' },
]

export const openFriendPut = async (id?: string, defaultType?: AiFriendType) => {
  const store = useAiFriendStore()
  const init = buildAiFriendForm()
  if (defaultType) init.type = defaultType
  const form = ref<AiFriendForm>(init)

  if (id) {
    const old = await store.getById(id)
    if (old) form.value = old
  }

  const dp = DialogPlugin({
    header: (id ? '修改' : '新增') + '好友',
    placement: 'center',
    width: '80vw',
    onConfirm: () => {
      store.put(form.value, id)
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
            <FormItem label={'类型'} name={'type'}>
              <Select
                v-model={form.value.type}
                options={typeOptions}
                placeholder={'请选择好友类型'}
              />
            </FormItem>
            <FormItem label={'好友名称'} name={'name'}>
              <Input v-model={form.value.name} placeholder={'请输入好友名称'} />
            </FormItem>
            <FormItem label={'好友简介'} name={'description'}>
              <Textarea
                v-model={form.value.description}
                placeholder={'请输入好友简介'}
                autosize={{ minRows: 2, maxRows: 4 }}
              />
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
                placeholder={'请选择启用的工具'}
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

export const openFriendContextmenu = (e: MouseEvent, id: string) => {
  useContextMenu(e, {
    items: [
      {
        icon: () => <EditIcon />,
        label: '编辑',
        onClick: () => openFriendPut(id)
      },
      {
        icon: () => <DeleteIcon class={'color-red'} />,
        label: <span class={'color-red'}>删除</span>,
        onClick: () => {
          MessageBoxUtil.confirm('确定删除该好友？', '删除确认')
            .then(() => {
              const store = useAiFriendStore()
              return store.remove(id)
            })
            .then(() => {
              MessageUtil.success('删除成功')
            })
            .catch(() => {})
        }
      }
    ]
  })
}
