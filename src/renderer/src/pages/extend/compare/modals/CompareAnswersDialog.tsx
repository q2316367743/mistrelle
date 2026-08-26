import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import CompareAnswersContent from './CompareAnswersContent.vue'
import type { CompareRecord } from '../compare-types'

/**
 * 单题答案对比弹窗（命令式 DialogPlugin）：
 * 内容组件 CompareAnswersContent.vue 展示该题所有模型回答 vs 参考答案（人工复核用）。
 */
export const openCompareAnswers = (record: CompareRecord, questionKey: string) => {
  const dp = DialogPlugin({
    header: '答案对比',
    placement: 'center',
    width: 'clamp(520px, 72%, 860px)',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(CompareAnswersContent, {
        record,
        questionKey,
        onClose: () => dp?.destroy?.()
      })
  })
}
