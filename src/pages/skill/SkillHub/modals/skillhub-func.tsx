import { defineComponent, ref } from 'vue'
import { DialogPlugin, Form, FormItem, Select, Switch, Progress } from 'tdesign-vue-next'
import { MessageUtil } from '@/utils/modal'
import { localSkillCacheClear, skillAgentList, type SkillAgent } from '@/modules/skill'
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
 */
export const openSkillHubDownload = (skill: ApiSkill, onSuccess?: () => void) => {
  const agents = skillAgentList()
  if (agents.length === 0) {
    MessageUtil.warning('暂无可用 Agent 目录，请先在本地 Skill 中配置')
    return
  }

  const state = ref<DownloadState>({
    agentKey: agents[0].key,
    overwrite: false,
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
