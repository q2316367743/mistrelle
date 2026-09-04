import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import CompareQuestionEditContent from './CompareQuestionEditContent.vue'

/**
 * 题库题目编辑弹窗（命令式 DialogPlugin）：
 * 内容组件 CompareQuestionEditContent.vue 承载表单，确认后直接调 composable 单例 upsertQuestion 落库并关闭。
 * question 为 null 表示新增（需要 nextOrder 计算排序位）。
 */
export const openQuestionEditDialog = (question: CompareQuestionInput | null, nextOrder?: number) => {
  const dp = DialogPlugin({
    header: question ? '编辑题目' : '新增题目',
    placement: 'center',
    width: 'clamp(480px, 56%, 680px)',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(CompareQuestionEditContent, {
        question,
        nextOrder: nextOrder ?? 0,
        onClose: () => dp?.destroy?.()
      })
  })
}