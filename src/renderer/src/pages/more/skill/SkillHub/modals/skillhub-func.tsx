import { defineComponent, ref } from 'vue'
import { CheckboxGroup, DialogPlugin, Form, FormItem, Select, Switch, Progress } from 'tdesign-vue-next'
import { MessageUtil } from '@/utils/modal'
import {
  localSkillCacheClear,
  localSkillRemove,
  skillAgentList,
  type LocalSkill,
  type SkillAgent
} from '@/modules/skill'
import { skillHubInstall, type ApiSkill } from '@/modules/skillhub'

interface DownloadState {
  agentKey: string
  overwrite: boolean
  downloading: boolean
  progress: number
}

const DownloadForm = defineComponent({
  name: 'SkillHubDownloadForm',
  props: {
    skill: {
      type: Object as () => ApiSkill,
      required: true
    },
    agents: {
      type: Array as () => Array<SkillAgent>,
      required: true
    },
    state: {
      type: Object as () => DownloadState,
      required: true
    }
  },
  setup(props) {
    return () => {
      const agentOptions = props.agents.map((e) => ({
        label: `${e.name}（${e.path}）`,
        value: e.key
      }))
      return (
        <Form data={props.state}>
          <FormItem label="Skill" name="slug">
            <div style={{ font: 'var(--td-font-body-medium)', color: 'var(--td-text-color-primary)' }}>
              {props.skill.name}
              <span style={{ marginLeft: '8px', color: 'var(--td-text-color-secondary)' }}>
                {props.skill.slug}
              </span>
            </div>
          </FormItem>
          <FormItem label="安装到" name="agentKey">
            <Select
              v-model={props.state.agentKey}
              options={agentOptions}
              disabled={props.state.downloading}
              filterable
            />
          </FormItem>
          <FormItem label="覆盖已有" name="overwrite">
            <Switch v-model={props.state.overwrite} disabled={props.state.downloading} />
          </FormItem>
          {props.state.downloading ? (
            <FormItem label="进度" name="progress">
              <Progress percentage={props.state.progress} />
            </FormItem>
          ) : null}
        </Form>
      )
    }
  }
})

/**
 * 选择 Agent 目录并下载安装 Skill
 * options.overwrite 用于预置「覆盖已有」开关（升级场景传 true）
 */
export const openSkillHubDownload = (
  skill: ApiSkill,
  onSuccess?: () => void,
  options?: { overwrite?: boolean }
) => {
  const agents = skillAgentList()
  if (agents.length === 0) {
    MessageUtil.warning('暂无可用 Agent 目录，请先在本地 Skill 中配置')
    return
  }

  const state = ref<DownloadState>({
    agentKey: agents[0].key,
    overwrite: options?.overwrite ?? false,
    downloading: false,
    progress: 0
  })

  const dp = DialogPlugin({
    header: `下载「${skill.name}」`,
    placement: 'center',
    width: '520px',
    confirmBtn: '下载并安装',
    closeOnOverlayClick: false,
    onConfirm: async () => {
      if (state.value.downloading) return false
      const agent = agents.find((e) => e.key === state.value.agentKey)
      if (!agent) {
        MessageUtil.warning('请选择安装目录')
        return false
      }
      state.value.downloading = true
      state.value.progress = 0
      dp.update({ confirmLoading: true, closeBtn: false, cancelBtn: null })
      try {
        const path = await skillHubInstall(skill.slug, agent, {
          overwrite: state.value.overwrite,
          onDownloadProgress: (e) => {
            if (e.total && e.total > 0) {
              state.value.progress = Math.min(99, Math.round((e.loaded / e.total) * 100))
            }
          }
        })
        state.value.progress = 100
        MessageUtil.success(`已安装到 ${path}`)
        localSkillCacheClear()
        dp.destroy()
        onSuccess?.()
      } catch (e) {
        MessageUtil.error('下载失败', e)
        dp.update({ confirmLoading: false, closeBtn: true, cancelBtn: '取消' })
      } finally {
        state.value.downloading = false
      }
      return false
    },
    default: () => <DownloadForm skill={skill} agents={agents} state={state.value} />
  })
}

/**
 * 卸载 Skill 的指定副本（可勾选多个 Agent 目录）
 */
export const openSkillHubUninstall = (
  skill: ApiSkill,
  copies: Array<LocalSkill>,
  onSuccess?: () => void
) => {
  if (copies.length === 0) {
    MessageUtil.warning('未找到已安装的副本')
    return
  }

  const checked = ref<Array<string>>(copies.map((e) => e.path))
  const options = copies.map((e) => ({
    label: `${e.agentName}（${e.path}）`,
    value: e.path
  }))

  const dp = DialogPlugin({
    header: `卸载「${skill.name}」`,
    placement: 'center',
    width: '520px',
    confirmBtn: '卸载',
    closeOnOverlayClick: false,
    onConfirm: async () => {
      const selected = copies.filter((e) => checked.value.includes(e.path))
      if (selected.length === 0) {
        MessageUtil.warning('请选择要卸载的副本')
        return false
      }
      try {
        await Promise.all(selected.map((e) => localSkillRemove(e)))
        MessageUtil.success(`已卸载 ${selected.length} 个副本`)
        localSkillCacheClear()
        dp.destroy()
        onSuccess?.()
      } catch (e) {
        MessageUtil.error('卸载失败', e)
      }
      return false
    },
    default: () => (
      <div>
        <div
          style={{
            marginBottom: '8px',
            font: 'var(--td-font-body-small)',
            color: 'var(--td-text-color-secondary)'
          }}
        >
          共发现 {copies.length} 个副本，请选择要卸载的：
        </div>
        <CheckboxGroup v-model={checked.value} options={options} />
      </div>
    )
  })
}
