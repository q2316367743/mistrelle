import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import SelectionHumanizeContent from './SelectionHumanizeContent.vue'

export interface OpenSelectionHumanizeDialogOptions {
  /** 选中原文 */
  original: string
  /** 去 AI 味改写结果 */
  result: string
  /** 点击「替换」：调用方负责写回编辑器并解锁 */
  onReplace: () => void
  /** 点击「取消」：调用方负责丢弃结果并解锁 */
  onCancel: () => void
}

/**
 * 选片段去 AI 味对比弹窗（命令式 DialogPlugin）：monaco diff 双栏只读对比，
 * 左=选中原文（original）、右=改写结果（modified），内容在 SelectionHumanizeContent.vue。
 * 改写已消耗积分：禁 ESC / 遮罩 / 右上角关闭等一切旁路关闭，只允许「替换 / 取消」两个出口。
 */
export const openSelectionHumanizeDialog = (
  options: OpenSelectionHumanizeDialogOptions
): { destroy?: () => void } => {
  const dp = DialogPlugin({
    header: '去 AI 味 · 改写对比',
    placement: 'center',
    width: 'min(960px, 94vw)',
    footer: false,
    closeBtn: false,
    closeOnOverlayClick: false,
    closeOnEscKeydown: false,
    destroyOnClose: true,
    body: () =>
      h(SelectionHumanizeContent, {
        original: options.original,
        result: options.result,
        onReplace: () => {
          dp?.destroy?.()
          options.onReplace()
        },
        onCancel: () => {
          dp?.destroy?.()
          options.onCancel()
        }
      })
  })
  return { destroy: () => dp?.destroy?.() }
}
