import { computed } from 'vue'
import { DialogPlugin, Form, FormItem, Input, Select, Textarea, Button } from 'tdesign-vue-next'
import { MessageUtil } from '@/utils/modal'
import { useAiPromptStore, useAiDiscussionStore, useSettingAiStore } from '@/store'
import type { AiDiscussion, AiDiscussionRole } from '@/entity/ai'
import { toolOptions } from '@/modules/tool'

interface RoleEditOptions {
  /** 参与者角色可删；总结者角色不可删 */
  deletable?: boolean
}

/** 点击群成员头像时打开的角色编辑弹窗（修改 AiDiscussionRole 参数） */
export const openRoleEdit = (
  discussion: AiDiscussion,
  role: AiDiscussionRole,
  options: RoleEditOptions = {}
) => {
  const promptStore = useAiPromptStore()
  const promptOptions = computed(() => promptStore.state.map((p) => ({ label: p.name, value: p.id })))
  const modelOptions = useSettingAiStore().options

  const persist = () => useAiDiscussionStore().put(discussion, discussion.id)

  const dp = DialogPlugin({
    header: `${role.name || '角色'} 设置`,
    placement: 'center',
    width: '640px',
    onConfirm: () => {
      persist()
        .then(() => {
          MessageUtil.success('已保存')
          dp.destroy()
        })
        .catch((e) => MessageUtil.error('保存失败', e))
    },
    default: () => (
      <div>
        <Form data={role} labelWidth={'96px'}>
          <FormItem label={'选择提示词'}>
            <Select
              v-model={role.promptId}
              options={promptOptions.value}
              placeholder={'请选择提示词快速填充'}
              clearable={true}
              onChange={(value) => {
                const id = String(value)
                if (id) {
                  promptStore.getById(id).then((p) => {
                    if (p) {
                      role.name = p.name
                      role.description = p.description
                      role.prompt = p.prompt
                      role.model = p.model
                      role.tools = [...(p.tools || [])]
                    }
                  })
                }
              }}
            />
          </FormItem>
          <FormItem label={'角色名称'}>
            <Input v-model={role.name} placeholder={'请输入角色名称'} />
          </FormItem>
          <FormItem label={'角色描述'}>
            <Textarea v-model={role.description} placeholder={'请输入角色描述'} autosize={{ minRows: 2, maxRows: 4 }} />
          </FormItem>
          <FormItem label={'系统提示词'}>
            <Textarea v-model={role.prompt} placeholder={'请输入系统提示词'} autosize={{ minRows: 3, maxRows: 8 }} />
          </FormItem>
          <FormItem label={'关联模型'}>
            <Select v-model={role.model} options={modelOptions} placeholder={'请选择关联模型'} clearable={true} />
          </FormItem>
          <FormItem label={'启用工具'}>
            <Select
              v-model={role.tools}
              options={toolOptions}
              placeholder={'请选择角色启用的工具'}
              multiple={true}
              filterable={true}
            />
          </FormItem>
        </Form>
        {options.deletable && (
          <div style={{ marginTop: '12px', textAlign: 'right' }}>
            <Button
              theme={'danger'}
              variant={'outline'}
              onClick={() => {
                const idx = discussion.roles.findIndex((r) => r.id === role.id)
                if (idx >= 0) {
                  discussion.roles.splice(idx, 1)
                  discussion.roles.forEach((r, i) => {
                    r.index = i
                  })
                }
                persist()
                  .then(() => {
                    MessageUtil.success('已删除角色')
                    dp.destroy()
                  })
                  .catch((e) => MessageUtil.error('删除失败', e))
              }}
            >
              删除角色
            </Button>
          </div>
        )}
      </div>
    )
  })
}
