import {
  Avatar,
  Button,
  DatePicker,
  DialogPlugin,
  Select,
  Tag,
  TagInput,
  Textarea,
  Tooltip
} from 'tdesign-vue-next'
import './PlanDetailDialog.less'
import {
  AttachIcon,
  ChatAddIcon,
  CopyIcon,
  DeleteIcon,
  MoreIcon,
  SendIcon,
  UserIcon
} from 'tdesign-icons-vue-next'
import {
  PLAN_PRIORITIES,
  PLAN_PRIORITY_META,
  PLAN_STATUSES,
  PLAN_STATUS_META,
  buildProjectPlanFilesDir,
  buildProjectPlanUpdateLog,
  projectPlanListFiles,
  projectPlanLogAppend,
  projectPlanLogList,
  projectPlanUpdate
} from '@/modules/project'
import { useSnowflake } from '@/hooks'
import { MessageUtil } from '@/utils/modal'
import { useContextMenu } from '@/hooks/UseContextMenu'
import { prettyDate } from '@/utils/lang/FormatUtil'
import type {
  ProjectPlan,
  ProjectPlanLog,
  ProjectPlanPriority,
  ProjectPlanStatus
} from '@/entity/project/ProjectPlan'
import { copyText } from '@/utils/native'

export interface PlanDetailDialogParams {
  projectId: string
  plan: ProjectPlan
  /** 任意字段或日志发生变化后通知父组件刷新 */
  onChange?: () => Promise<void> | void
  onAddTask: () => void
}

const statusOptions = PLAN_STATUSES.map((s) => ({
  label: PLAN_STATUS_META[s].label,
  value: s
}))
const priorityOptions = PLAN_PRIORITIES.map((p) => ({
  label: PLAN_PRIORITY_META[p].label,
  value: p
}))

const splitName = (p: string) => p.split('/').pop() || p.split('\\').pop() || 'file'

const uniquePath = (baseDir: string, name: string): string => {
  let dest = window.preload.path.join(baseDir, name)
  if (!window.preload.fs.existsSync(dest)) return dest
  const extIdx = name.lastIndexOf('.')
  const stem = extIdx > 0 ? name.slice(0, extIdx) : name
  const ext = extIdx > 0 ? name.slice(extIdx) : ''
  let i = 1
  while (window.preload.fs.existsSync(dest)) {
    dest = window.preload.path.join(baseDir, `${stem} (${i})${ext}`)
    i++
  }
  return dest
}

/**
 * 打开计划详情弹窗：左栏只读展示标题/内容/附件/动态，右栏 5 字段行内编辑；
 * 字段变更时按"修改前后差值"自动落盘并追加变更日志；评论与附件独立追加日志。
 */
export const openPlanDetailDialog = (params: PlanDetailDialogParams) => {
  const { projectId, plan: initial, onChange } = params

  const plan = ref<ProjectPlan>({ ...initial, tags: [...initial.tags] })
  // 上次落盘快照：连续多次改动时按"最近一次 vs 起始状态"产生一组日志
  const baseline = JSON.parse(JSON.stringify(initial)) as ProjectPlan

  const logs = ref<ProjectPlanLog[]>([])
  const files = ref<Array<FileItem>>([])
  const comment = ref('')
  const commentInputRef = ref<{ focus?: () => void } | null>(null)

  const loadLogs = async () => {
    try {
      logs.value = await projectPlanLogList(projectId, plan.value.id)
    } catch (e) {
      MessageUtil.error('读取动态失败', e)
      logs.value = []
    }
  }

  const loadFiles = async () => {
    try {
      files.value = await projectPlanListFiles(projectId, plan.value.id)
    } catch (e) {
      MessageUtil.error('读取附件失败', e)
      files.value = []
    }
  }

  /**
   * 应用一次字段变更：以 baseline 计算差值落盘后回填 baseline，
   * 避免连续拖动/连续输入时产生"过度细化"的中间日志。
   */
  const applyChange = async (mutator: (p: ProjectPlan) => void) => {
    const draft = JSON.parse(JSON.stringify(plan.value)) as ProjectPlan
    mutator(draft)
    draft.updatedAt = Date.now()

    const diffLogs = buildProjectPlanUpdateLog(baseline, draft)
    if (diffLogs.length === 0) return

    plan.value = draft
    try {
      await projectPlanUpdate(projectId, draft)
      for (const log of diffLogs) {
        await projectPlanLogAppend(projectId, draft.id, log)
      }
      baseline.tags = [...draft.tags]
      baseline.status = draft.status
      baseline.priority = draft.priority
      baseline.startDate = draft.startDate
      baseline.endDate = draft.endDate
      baseline.updatedAt = draft.updatedAt
      await loadLogs()
      if (onChange) await onChange()
    } catch (e) {
      MessageUtil.error('保存失败', e)
    }
  }

  // 评论：组件自己维护输入态，提交后自行清空（高内聚）
  const handleSendComment = async () => {
    const text = comment.value.trim()
    if (!text) return
    const now = Date.now()
    const log: ProjectPlanLog = {
      id: useSnowflake().nextId().toString(),
      type: 'comment',
      description: text,
      createdAt: now,
      updatedAt: now
    }
    try {
      await projectPlanLogAppend(projectId, plan.value.id, log)
      comment.value = ''
      await loadLogs()
    } catch (e) {
      MessageUtil.error('发送评论失败', e)
    }
  }

  const focusComment = () => {
    params.onAddTask()
  }

  // 附件：调起系统选择框 → copyFile → 追加 'attachment' 日志
  const handleAddAttachment = async () => {
    const paths = window.preload.inject.dialog.open({
      title: '选择文件',
      properties: ['openFile', 'multiSelections']
    })
    if (!paths || paths.length === 0) return
    try {
      const filesDir = buildProjectPlanFilesDir(projectId, plan.value.id)
      for (const p of paths) {
        const dest = uniquePath(filesDir, splitName(p))
        await window.preload.fs.copyFile(p, dest)
      }
      const now = Date.now()
      const log: ProjectPlanLog = {
        id: useSnowflake().nextId().toString(),
        type: 'attachment',
        description:
          paths.length === 1
            ? `添加了附件 ${splitName(paths[0])}`
            : `添加了 ${paths.length} 个附件`,
        createdAt: now,
        updatedAt: now
      }
      await projectPlanLogAppend(projectId, plan.value.id, log)
      MessageUtil.success(`已上传 ${paths.length} 个文件`)
      await Promise.all([loadFiles(), loadLogs()])
    } catch (e) {
      MessageUtil.error('上传失败', e)
    }
  }

  const openAttachment = (it: FileItem) => {
    if (it.isDirectory) return
    window.preload.inject.shell.openPath(it.path)
  }

  const handleStatusChange = (next: unknown) => {
    void applyChange((p) => {
      p.status = next as ProjectPlanStatus
    })
  }
  const handleStartDateChange = (next: unknown) => {
    void applyChange((p) => {
      p.startDate = String(next)
    })
  }
  const handleEndDateChange = (next: unknown) => {
    void applyChange((p) => {
      p.endDate = String(next)
    })
  }
  const handlePriorityChange = (next: unknown) => {
    void applyChange((p) => {
      p.priority = next as ProjectPlanPriority
    })
  }
  const handleTagsChange = (next: Array<string | number>) => {
    void applyChange((p) => {
      p.tags = next.map((t) => String(t))
    })
  }

  const handleMoreMenu = (e: MouseEvent) => {
    useContextMenu(e, {
      items: [
        {
          icon: () => <CopyIcon />,
          label: '复制为指令',
          divided: 'down',
          onClick: () => {
            copyText(`<task id="${plan.value.id}">
<title>${plan.value.title}</title>
<desc>
${plan.value.content}
</desc>
<project id="${params.projectId}"/>
</task>`)
            MessageUtil.success('已复制为指令')
          }
        },
        {
          icon: () => <DeleteIcon class="color-red" />,
          label: <span class="color-red">删除</span>,
          onClick: () => MessageUtil.warning('请到列表页右键删除（占位）')
        }
      ]
    })
  }

  DialogPlugin({
    header: () => (
      <div class="flex items-center justify-between w-full">
        <span class="font-semibold">待办详情</span>
        <div class="flex items-center gap-8px">
          <Tooltip content={'添加到对话框'}>
            <Button
              variant="text"
              shape={'square'}
              class={'shrink-0'}
              size={'small'}
              icon={() => <ChatAddIcon class={'t-icon-close'} />}
              onClick={focusComment}
            />
          </Tooltip>
          <Button
            variant="text"
            shape={'square'}
            class={'shrink-0'}
            size={'small'}
            icon={() => <MoreIcon class={'t-icon-close'} />}
            onClick={handleMoreMenu}
          />
        </div>
      </div>
    ),
    width: '1080px',
    placement: 'center',
    footer: false,
    default: () => (
      <div class="plan-detail">
        <div class="plan-detail__left">
          <div class="plan-detail__title">{plan.value.title || '未命名计划'}</div>
          {plan.value.content && <div class="plan-detail__content">{plan.value.content}</div>}

          <div class="plan-detail__files">
            <div class="plan-detail__files-add" onClick={handleAddAttachment}>
              <AttachIcon />
              <span>添加附件</span>
            </div>
            {files.value.length > 0 && (
              <div class="plan-detail__files-list">
                {files.value.map((f) => (
                  <Tag
                    key={f.path}
                    size="small"
                    variant="light"
                    theme="primary"
                    class="cursor-pointer"
                    onClick={() => openAttachment(f)}
                  >
                    {f.name}
                  </Tag>
                ))}
              </div>
            )}
          </div>

          <div class="plan-detail__divider" />

          <div class="plan-detail__logs">
            <div class="plan-detail__logs-title">动态</div>
            {logs.value.length === 0 ? (
              <div class="plan-detail__logs-empty">暂无动态</div>
            ) : (
              <t-timeline layout="vertical" mode="same" labelAlign="left" theme="dot">
                {logs.value.map((log) => (
                  <t-timeline-item
                    key={log.id}
                    label={prettyDate(log.createdAt)}
                    dotColor={log.type === 'comment' ? 'primary' : 'default'}
                  >
                    <div class="plan-detail__log-row">
                      <Avatar size="24px" shape="circle" v-slots={{ icon: () => <UserIcon /> }} />
                      <div
                        class={
                          'plan-detail__log-text' +
                          (log.type === 'comment' ? ' plan-detail__log-text--comment' : '')
                        }
                      >
                        {log.description}
                      </div>
                    </div>
                  </t-timeline-item>
                ))}
              </t-timeline>
            )}
          </div>

          <div class="plan-detail__comment">
            <Textarea
              ref={commentInputRef}
              v-model={comment.value}
              placeholder="添加评论"
              autosize={{ minRows: 1, maxRows: 4 }}
              onKeydown={(_value, { e }) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSendComment()
                }
              }}
            />
            <Button
              theme="primary"
              shape="square"
              size={'small'}
              class="plan-detail__comment-send"
              v-slots={{ icon: () => <SendIcon /> }}
              onClick={handleSendComment}
            />
          </div>
        </div>

        <div class="plan-detail__right">
          <Field label="状态">
            <Select
              v-model={plan.value.status}
              options={statusOptions}
              size="medium"
              onChange={handleStatusChange}
            />
          </Field>
          <Field label="开始日期">
            <DatePicker
              v-model={plan.value.startDate}
              valueType="YYYY-MM-DD"
              format="YYYY-MM-DD"
              enableTimePicker={false}
              placeholder="开始日期"
              size="medium"
              onChange={handleStartDateChange}
            />
          </Field>
          <Field label="截止日期">
            <DatePicker
              v-model={plan.value.endDate}
              valueType="YYYY-MM-DD"
              format="YYYY-MM-DD"
              enableTimePicker={false}
              placeholder="截止日期"
              size="medium"
              onChange={handleEndDateChange}
            />
          </Field>
          <Field label="优先级">
            <Select
              v-model={plan.value.priority}
              options={priorityOptions}
              size="medium"
              onChange={handlePriorityChange}
            />
          </Field>
          <Field label="标签" full>
            <TagInput
              v-model={plan.value.tags}
              clearable
              placeholder="未设置"
              size="medium"
              onChange={handleTagsChange}
            />
          </Field>
        </div>
      </div>
    ),
    onOpened: () => {
      void loadLogs()
      void loadFiles()
    }
  })
}

const Field = (
  props: { label: string; full?: boolean },
  { slots }: { slots: { default?: () => unknown } }
) => (
  <div class={'plan-detail__field' + (props.full ? ' plan-detail__field--full' : '')}>
    <div class="plan-detail__field-label">{props.label}</div>
    <div class="plan-detail__field-value">{slots.default?.()}</div>
  </div>
)
