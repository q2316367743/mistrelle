import { defineAsyncComponent } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'

const PlanFilesPanel = defineAsyncComponent(
  () => import('@/pages/project/plan/components/PlanFilesPanel.vue')
)

export interface PlanFilesDialogParams {
  projectId: string
  planId: string
  title: string
}

/**
 * 打开计划附件独立管理弹窗（薄壳，内部复用 PlanFilesPanel）
 */
export const openPlanFilesDialog = (params: PlanFilesDialogParams) => {
  const { projectId, planId, title } = params
  DialogPlugin({
    header: `附件：${title}`,
    width: '560px',
    placement: 'center',
    default: () => (
      <div class={'mt-8px'}>
        <PlanFilesPanel projectId={projectId} planId={planId} />
      </div>
    )
  })
}
