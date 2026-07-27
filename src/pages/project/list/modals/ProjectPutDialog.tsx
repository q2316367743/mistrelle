import { DialogPlugin, Form, FormItem, Input, TabPanel, Tabs, Textarea, Select } from 'tdesign-vue-next'
import { onBeforeMount, ref, computed, unref } from 'vue'
import { ProjectForm, buildProjectForm, toProjectForm } from '@/entity'
import { useProjectStore, useAiAgentStore } from '@/store'
import { toolOptions } from '@/modules/tool'
import { localSkillList, LocalSkill } from '@/modules/skill'
import { ProjectTemplate } from '@/modules/project'
import { MessageUtil } from '@/utils/modal'

export const openProjectPut = (id?: string, template?: ProjectTemplate) => {
  const store = useProjectStore()
  const old = store.getById(id)
  const form = ref<ProjectForm>(
    old ? toProjectForm(old) : template ? template.prefill() : buildProjectForm()
  )

  const skills = ref<Array<LocalSkill>>([])
  onBeforeMount(async () => {
    skills.value = await localSkillList()
  })

  const agentOptions = useAiAgentStore().options
  const skillOptions = computed(() =>
    skills.value.map((s) => ({ label: s.name, value: s.dirName }))
  )

  const header = old
    ? `编辑项目：${old.name}`
    : template
      ? `从模版创建：${template.name}`
      : '新建项目'

  const dp = DialogPlugin({
    header,
    width: '720px',
    placement: 'center',
    onConfirm: () => {
      if (!form.value.name.trim()) {
        MessageUtil.error('请填写项目名')
        return
      }
      store
        .put(form.value, id)
        .then(() => {
          MessageUtil.success('保存成功')
          dp.destroy()
        })
        .catch((e) => MessageUtil.error('保存失败', e))
    },
    default: () => (
      <Tabs defaultValue="basic">
        <TabPanel label="基础信息" value="basic">
          <Form data={form.value} class={'mt-8px'}>
            <FormItem label="项目名称" name="name">
              <Input v-model={form.value.name} placeholder="请输入项目名" />
            </FormItem>
            <FormItem label="项目指令" name="prompt">
              <Textarea
                v-model={form.value.prompt}
                placeholder="提供项目的背景信息与规范"
                autosize={{ minRows: 6, maxRows: 14 }}
              />
            </FormItem>
          </Form>
        </TabPanel>
        <TabPanel label="Agent" value="agents">
          <div class={'mt-8px'}>
            <Select
              v-model={form.value.agents}
              options={unref(agentOptions)}
              multiple
              filterable
              placeholder="选择本项目可用的专家"
            />
          </div>
        </TabPanel>
        <TabPanel label="技能" value="skills">
          <div class={'mt-8px'}>
            <Select
              v-model={form.value.skills}
              options={unref(skillOptions)}
              multiple
              filterable
              placeholder="选择本项目可用的技能"
            />
          </div>
        </TabPanel>
        <TabPanel label="工具" value="tools">
          <div class={'mt-8px'}>
            <Select
              v-model={form.value.tools}
              options={toolOptions}
              multiple
              filterable
              placeholder="选择本项目可用的工具"
            />
          </div>
        </TabPanel>
      </Tabs>
    )
  })
}
