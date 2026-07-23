import { AiAgentForm, buildAiAgentForm } from '@/entity/ai'
import { useAiAgentStore, useSettingAiStore } from '@/store'
import { toolOptions, toolMap } from '@/modules/tool'
import {
  Avatar,
  Button,
  DialogPlugin,
  Form,
  FormItem,
  Input,
  Select,
  Switch,
  TabPanel,
  Tag,
  Tabs,
  Textarea
} from 'tdesign-vue-next'
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'
import { useContextMenu } from '@/hooks'
import { DeleteIcon, EditIcon } from 'tdesign-icons-vue-next'
import './agent-func.less'
import { cloneDeep } from 'es-toolkit'

export const openAgentPut = (id?: string) => {
  const { getById, put } = useAiAgentStore()
  const old = getById(id)
  const form = ref<AiAgentForm>(old ? cloneDeep(old) : buildAiAgentForm())

  const dp = DialogPlugin({
    header: (old ? '修改' : '新增') + '分组',
    placement: 'center',
    width: '80vw',
    className: 'agent-dialog',
    onConfirm: () => {
      put(form.value, id)
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
        <Tabs defaultValue={'label'}>
          <TabPanel label={'基础信息'} value={'label'}>
            <Form data={form.value}>
              <FormItem label={'助手名称'} name={'name'}>
                <Input v-model={form.value.name} placeholder={'请输入助手名称'} />
              </FormItem>
              <FormItem label={'助手描述'} name={'description'}>
                <Textarea v-model={form.value.description} placeholder={'请输入助手描述'} />
              </FormItem>
              <FormItem label={'占位文案'} name={'placeholder'}>
                <Input v-model={form.value.placeholder} placeholder={'请输入输入框占位文案'} />
              </FormItem>
              <FormItem label={'默认模型'} name={'model'}>
                <Select
                  v-model={form.value.model}
                  options={modelOptions}
                  placeholder={'请选择默认模型'}
                  clearable={true}
                />
              </FormItem>
              <FormItem label={'启用思考'} name={'think'}>
                <Switch v-model={form.value.think} />
              </FormItem>
            </Form>
          </TabPanel>
          <TabPanel label={'助手身份'} value={'identity'}>
            <div class={'px-4px'}>
              <div class={'help'}>定义助手是谁，包括名字、角色定位和能力范围。</div>
              <Textarea
                v-model={form.value.identity}
                autosize={{ minRows: 6, maxRows: 17 }}
                placeholder={'请输入助手身份。支持 Markdown 格式，可用中文或英文书写'}
              />
            </div>
          </TabPanel>
          <TabPanel label={'助手性格'} value={'personality'}>
            <div class={'px-4px'}>
              <div class={'help'}>助手的性格、语气和行为准则。会强制助手遵循此设定。</div>
              <Textarea
                v-model={form.value.personality}
                autosize={{ minRows: 6, maxRows: 17 }}
                placeholder={'请输入助手性格。支持 Markdown 格式，可用中文或英文书写'}
              />
            </div>
          </TabPanel>
          <TabPanel label={'关于我'} value={'aboutMe'}>
            <div class={'px-4px'}>
              <div class={'help'}>关于你自己的信息（姓名、偏好等），助手会记住你。</div>
              <Textarea
                v-model={form.value.aboutMe}
                autosize={{ minRows: 6, maxRows: 17 }}
                placeholder={'请输入关于我。支持 Markdown 格式，可用中文或英文书写'}
              />
            </div>
          </TabPanel>
          <TabPanel label={'工具'} value={'tools'}>
            <div class={'px-4px'}>
              <Select
                v-model={form.value.tools}
                options={toolOptions}
                placeholder={'请选择分组启用的工具'}
                multiple={true}
                filterable={true}
              />
            </div>
          </TabPanel>
        </Tabs>
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
        onClick: () => {
          MessageBoxUtil.confirm(
            '确定要删除吗？会删除全部的聊天记录，数据不可恢复',
            '删除确认'
          ).then(() => {
            useAiAgentStore()
              .remove(id)
              .then(() => MessageUtil.success('删除成功'))
              .catch((e) => MessageUtil.error('删除失败', e))
          })
        }
      }
    ]
  })
}

const renderPreviewSection = (title: string, content?: string) => {
  if (!content || !content.trim()) return null
  return (
    <div class={'agent-preview__section'}>
      <div class={'agent-preview__section-title'}>{title}</div>
      <div class={'agent-preview__section-body'}>{content}</div>
    </div>
  )
}

/**
 * 打开专家预览弹窗，展示身份/性格/关于我/工具等详情，并提供编辑入口
 */
export const openAgentPreview = (id: string) => {
  const agent = useAiAgentStore().getById(id)
  if (!agent) {
    MessageUtil.error('专家不存在')
    return
  }

  const modelLabel = (() => {
    for (const group of useSettingAiStore().options) {
      const hit = group.children?.find((item) => item.value === agent.model)
      if (hit) return String(hit.label)
    }
    return agent.model
  })()

  const dp = DialogPlugin({
    header: agent.name,
    width: '520px',
    placement: 'center',
    footer: false,
    default: () => (
      <div class={'agent-preview'}>
        <div class={'agent-preview__head'}>
          <Avatar size="48px" shape="round">
            {agent.name.slice(0, 1) || 'A'}
          </Avatar>
          <div class={'agent-preview__head-info'}>
            <div class={'agent-preview__name'}>{agent.name}</div>
            <div class={'agent-preview__desc'}>{agent.description || '暂无描述'}</div>
          </div>
        </div>
        <div class={'agent-preview__meta'}>
          <Tag size="small" variant="outline">
            {modelLabel || '默认模型'}
          </Tag>
          {agent.think && (
            <Tag size="small" theme="warning" variant="light">
              深度思考
            </Tag>
          )}
        </div>
        {renderPreviewSection('身份', agent.identity)}
        {renderPreviewSection('性格', agent.personality)}
        {renderPreviewSection('关于我', agent.aboutMe)}
        {agent.tools.length > 0 && (
          <div class={'agent-preview__section'}>
            <div class={'agent-preview__section-title'}>工具</div>
            <div class={'agent-preview__tools'}>
              {agent.tools.map((name) => (
                <Tag key={name} size="small" variant="outline">
                  {toolMap[name]?.label || name}
                </Tag>
              ))}
            </div>
          </div>
        )}
        <div class={'agent-preview__footer'}>
          <Button
            theme="default"
            onClick={() => {
              dp.destroy()
              openAgentPut(id)
            }}
          >
            编辑
          </Button>
        </div>
      </div>
    )
  })
}
