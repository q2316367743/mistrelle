import { Button, DialogPlugin, DrawerPlugin, Form, FormItem, Input, List, ListItem, Select, Textarea } from 'tdesign-vue-next'
import { nanoid } from 'nanoid'
import { MessageUtil, MessageBoxUtil } from '@/utils/modal'
import {
  LocalSkill,
  LocalSkillFile,
  LocalSkillForm,
  SkillAgent,
  buildDefaultSkillAgents,
  localSkillCreate,
  localSkillFileRead,
  localSkillRemove,
  skillAgentList,
  skillAgentSave
} from '@/modules/skill'
import { prettyDataUnit } from '@/utils/lang/FormatUtil'

const DIR_NAME_PATTERN = /^[a-z0-9][a-z0-9-_]*$/

/**
 * 新建 Skill
 */
export const openSkillPut = (onSuccess: () => void) => {
  const agents = skillAgentList()
  const form = ref<LocalSkillForm>({
    agentKey: agents[0]?.key ?? '',
    dirName: '',
    name: '',
    description: ''
  })
  const agentOptions = agents.map((e) => ({ label: e.name, value: e.key }))

  const dp = DialogPlugin({
    header: '新建 Skill',
    placement: 'center',
    width: '480px',
    onConfirm: async () => {
      if (!DIR_NAME_PATTERN.test(form.value.dirName)) {
        MessageUtil.warning('目录名需以小写字母或数字开头，仅含小写字母、数字、-、_')
        return false
      }
      if (!form.value.name.trim()) {
        MessageUtil.warning('请输入名称')
        return false
      }
      const agent = agents.find((e) => e.key === form.value.agentKey)
      if (!agent) {
        MessageUtil.warning('请选择所属 Agent')
        return false
      }
      try {
        await localSkillCreate(agent, form.value)
        MessageUtil.success('保存成功')
        dp.destroy()
        onSuccess()
      } catch (e) {
        MessageUtil.error('保存失败', e)
      }
      return true
    },
    default: () => (
      <Form data={form.value}>
        <FormItem label="所属 Agent" name="agentKey">
          <Select v-model={form.value.agentKey} options={agentOptions} />
        </FormItem>
        <FormItem label="目录名" name="dirName">
          <Input v-model={form.value.dirName} placeholder="唯一标识，如 my-skill" />
        </FormItem>
        <FormItem label="名称" name="name">
          <Input v-model={form.value.name} placeholder="请输入 Skill 名称" />
        </FormItem>
        <FormItem label="描述" name="description">
          <Textarea
            v-model={form.value.description}
            placeholder="请输入 Skill 描述"
            autosize={{ minRows: 2, maxRows: 4 }}
          />
        </FormItem>
      </Form>
    )
  })
}

/**
 * 删除 Skill
 */
export const openSkillRemove = (skill: LocalSkill, onSuccess: () => void) => {
  MessageBoxUtil.confirm(`确定删除 Skill「${skill.name}」？删除后不可恢复。`, '删除确认')
    .then(() => localSkillRemove(skill))
    .then(() => {
      MessageUtil.success('删除成功')
      onSuccess()
    })
    .catch(() => {})
}

/**
 * DialogPlugin 查看文件内容
 */
export const openSkillFileView = async (file: LocalSkillFile) => {
  let content = ''
  try {
    content = await localSkillFileRead(file.path)
  } catch (e) {
    MessageUtil.error('读取失败', e)
    return
  }
  DialogPlugin({
    header: `${file.relativePath}（${prettyDataUnit(file.size)}）`,
    placement: 'center',
    width: '70vw',
    footer: false,
    default: () => (
      <Textarea
        value={content}
        readonly={true}
        autosize={false}
        style={{ height: '60vh', fontFamily: 'var(--td-font-family-mono, monospace)' }}
      />
    )
  })
}

/**
 * 新增 / 编辑 Agent 目录
 */
const openAgentPut = (onSuccess: () => void, agents: Array<SkillAgent>, agent?: SkillAgent) => {
  const isEdit = !!agent
  const form = ref<SkillAgent>({
    key: agent?.key ?? nanoid(8),
    name: agent?.name ?? '',
    path: agent?.path ?? ''
  })

  const dp = DialogPlugin({
    header: (isEdit ? '编辑' : '新增') + ' Agent 目录',
    placement: 'center',
    width: '480px',
    onConfirm: () => {
      if (!form.value.name.trim()) {
        MessageUtil.warning('请输入名称')
        return false
      }
      if (!form.value.path.trim()) {
        MessageUtil.warning('请输入目录路径')
        return false
      }
      const index = agents.findIndex((e) => e.key === form.value.key)
      if (index >= 0) agents.splice(index, 1, { ...form.value })
      else agents.push({ ...form.value })
      skillAgentSave(agents)
      MessageUtil.success('保存成功')
      dp.destroy()
      onSuccess()
      return true
    },
    default: () => (
      <Form data={form.value}>
        <FormItem label="名称" name="name">
          <Input v-model={form.value.name} placeholder="如 Claude Code" />
        </FormItem>
        <FormItem label="目录路径" name="path">
          <Input v-model={form.value.path} placeholder="skills 目录的绝对路径" />
        </FormItem>
      </Form>
    )
  })
}

/**
 * 管理 Agent skills 目录
 */
export const openAgentManage = (onChange: () => void) => {
  const agents = ref<Array<SkillAgent>>(skillAgentList())
  const refresh = () => {
    agents.value = skillAgentList()
    onChange()
  }

  DrawerPlugin({
    header: 'Agent 目录管理',
    size: '480px',
    footer: false,
    default: () => (
      <div>
        <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
          <Button size="small" onClick={() => openAgentPut(refresh, agents.value)}>
            新增目录
          </Button>
          <Button
            size="small"
            variant="outline"
            onClick={() => {
              MessageBoxUtil.confirm('确定恢复默认目录？自定义目录将被覆盖。', '恢复确认')
                .then(() => {
                  skillAgentSave(buildDefaultSkillAgents())
                  refresh()
                })
                .catch(() => {})
            }}
          >
            恢复默认
          </Button>
        </div>
        <List split={true}>
          {agents.value.map((agent) => (
            <ListItem
              key={agent.key}
              action={() => (
                <div style={{ display: 'flex', gap: '4px' }}>
                  <Button size="small" variant="text" onClick={() => openAgentPut(refresh, agents.value, agent)}>
                    编辑
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    theme="danger"
                    onClick={() => {
                      MessageBoxUtil.confirm(`确定删除目录「${agent.name}」？不会删除磁盘文件。`, '删除确认')
                        .then(() => {
                          skillAgentSave(agents.value.filter((e) => e.key !== agent.key))
                          refresh()
                        })
                        .catch(() => {})
                    }}
                  >
                    删除
                  </Button>
                </div>
              )}
            >
              <div>
                <div style={{ font: 'var(--td-font-title-small)' }}>{agent.name}</div>
                <div style={{ font: 'var(--td-font-body-small)', color: 'var(--td-text-color-secondary)' }}>
                  {agent.path}
                </div>
              </div>
            </ListItem>
          ))}
        </List>
      </div>
    )
  })
}
