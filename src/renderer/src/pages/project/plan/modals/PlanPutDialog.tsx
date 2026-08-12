import { defineAsyncComponent, ref } from 'vue'
import {
  Button,
  DatePicker,
  DialogPlugin,
  Input,
  Select,
  TagInput,
  Textarea,
  Tooltip
} from 'tdesign-vue-next'
import { CloseIcon, Fullscreen1Icon, AttachIcon } from 'tdesign-icons-vue-next'
import {
  PLAN_PRIORITIES,
  PLAN_PRIORITY_META,
  PLAN_STATUSES,
  PLAN_STATUS_META
} from '@/modules/project'
import { useSnowflake } from '@/hooks'
import { MessageUtil } from '@/utils/modal'
import type { ProjectPlan, ProjectPlanStatus } from '@/entity/project/ProjectPlan'

const PlanFilesPanel = defineAsyncComponent(
  () => import('@/pages/project/plan/components/PlanFilesPanel.vue')
)

export interface PlanPutDialogParams {
  projectId: string
  current?: ProjectPlan
  /** 新建时的默认状态（来自列头的"+"） */
  defaultStatus?: ProjectPlanStatus
  /** 提交后回调：父组件收到 plan 后做落盘 */
  onSubmit: (plan: ProjectPlan) => Promise<void> | void
}

const todayYmd = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const buildEmptyPlan = (status: ProjectPlanStatus, now: number): ProjectPlan => {
  const today = todayYmd()
  return {
    id: useSnowflake().nextId().toString(),
    title: '',
    content: '',
    status,
    startDate: today,
    endDate: today,
    priority: 2,
    tags: [],
    createdAt: now,
    updatedAt: now
  }
}

const statusOptions = PLAN_STATUSES.map((s) => ({ label: PLAN_STATUS_META[s].label, value: s }))
const priorityOptions = PLAN_PRIORITIES.map((p) => ({
  label: PLAN_PRIORITY_META[p].label,
  value: p
}))

export const openPlanPutDialog = (params: PlanPutDialogParams) => {
  const { projectId, current, defaultStatus, onSubmit } = params
  const now = Date.now()
  const initial: ProjectPlan = current
    ? { ...current, tags: [...current.tags] }
    : buildEmptyPlan(defaultStatus ?? 'padding', now)
  const isEdit = !!current

  const form = ref<ProjectPlan>(initial)
  const startDate = ref<string>(initial.startDate)
  const endDate = ref<string>(initial.endDate)
  const fullscreen = ref(false)
  const showFiles = ref(false)

  const validate = (): string | null => {
    if (!form.value.title.trim()) return '请输入计划标题'
    if (startDate.value && endDate.value && startDate.value > endDate.value) {
      return '开始日期不能晚于结束日期'
    }
    return null
  }

  const handleConfirm = () => {
    const err = validate()
    if (err) {
      MessageUtil.error(err)
      return
    }
    const submit: ProjectPlan = {
      ...form.value,
      title: form.value.title.trim(),
      content: form.value.content,
      tags: form.value.tags,
      startDate: startDate.value,
      endDate: endDate.value,
      updatedAt: Date.now()
    }
    Promise.resolve(onSubmit(submit))
      .then(() => {
        MessageUtil.success(isEdit ? '已保存' : '已创建')
        dp.destroy()
      })
      .catch((e) => MessageUtil.error('保存失败', e))
  }

  const dp = DialogPlugin({
    header: () => (
      <div class={'plan-put__header'}>
        <span class={'plan-put__header-title'}>{isEdit ? '编辑待办' : '新建待办'}</span>
        <div class={'plan-put__header-actions'}>
          <t-button
            variant="text"
            shape="square"
            size="small"
            v-slots={{ icon: () => <Fullscreen1Icon /> }}
            onClick={() => (fullscreen.value = !fullscreen.value)}
          />
          <t-button
            variant="text"
            shape="square"
            size="small"
            v-slots={{ icon: () => <CloseIcon /> }}
            onClick={() => dp.destroy()}
          />
        </div>
      </div>
    ),
    width: fullscreen.value ? '95vw' : '720px',
    placement: 'center',
    footer: () => (
      <div>
        <div class={'flex justify-between items-center'}>
          <Tooltip content={isEdit ? '管理附件' : '保存后可管理附件'}>
            <Button
              variant="text"
              shape="circle"
              v-slots={{ icon: () => <AttachIcon /> }}
              onClick={() => (showFiles.value = !showFiles.value)}
            />
          </Tooltip>
          <div class={'flex gap-8px'}>
            <Button theme="default" variant="outline" onClick={() => dp.destroy()}>
              取消
            </Button>
            <Button theme="primary" onClick={handleConfirm}>
              {isEdit ? '保存' : '创建'}
            </Button>
          </div>
        </div>

        {showFiles.value && isEdit && (
          <div class={'plan-put__files'}>
            <PlanFilesPanel projectId={projectId} planId={form.value.id} />
          </div>
        )}
      </div>
    ),
    onConfirm: handleConfirm,
    default: () => (
      <div class={'mx-4px'}>
        <Input
          v-model={form.value.title}
          placeholder="请输入标题"
          borderless
          autofocus
          maxlength={120}
          onEnter={handleConfirm}
        />

        <Textarea
          v-model={form.value.content}
          class={'mt-8px'}
          placeholder="添加描述（可选）"
          autosize={{ minRows: 6, maxRows: 12 }}
        />

        <div class={'flex gap-8px mt-8px'}>
          <Select
            v-model={form.value.status}
            options={statusOptions}
            size="medium"
            class={' w-100px'}
          />
          <DatePicker
            v-model={startDate.value}
            valueType="YYYY-MM-DD"
            format="YYYY-MM-DD"
            enableTimePicker={false}
            placeholder="开始日期"
            class={' w-130px'}
          />
          <DatePicker
            v-model={endDate.value}
            valueType="YYYY-MM-DD"
            format="YYYY-MM-DD"
            enableTimePicker={false}
            placeholder="截止日期"
            class={' w-130px'}
          />
          <Select
            v-model={form.value.priority}
            options={priorityOptions}
            size="medium"
            class={' w-80px'}
          />
        </div>

        <TagInput
          v-model={form.value.tags}
          clearable
          placeholder="添加标签（按回车确认）"
          class={'mt-8px'}
        />
      </div>
    )
  })
}
