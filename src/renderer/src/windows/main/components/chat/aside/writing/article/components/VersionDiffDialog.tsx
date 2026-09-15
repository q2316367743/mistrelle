import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import VersionDiffContent from './VersionDiffContent.vue'

export interface OpenVersionDiffDialogOptions {
  /** 左侧（当前版本）标题，如「第2版 · 去 AI 味」 */
  currentLabel: string
  /** 右侧（所选版本）标题 */
  targetLabel: string
  /** 当前版本正文（编辑器实时内容） */
  currentContent: string
  /** 所选版本正文 */
  targetContent: string
}

/**
 * 版本对比弹窗（命令式 DialogPlugin）：monaco diff 双栏只读对比，
 * 左=当前版本（original）、右=所选版本（modified），内容在 VersionDiffContent.vue。
 */
export const openVersionDiffDialog = (options: OpenVersionDiffDialogOptions): void => {
  const dp = DialogPlugin({
    header: '版本对比',
    placement: 'center',
    width: 'min(1100px, 94vw)',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(VersionDiffContent, {
        currentLabel: options.currentLabel,
        targetLabel: options.targetLabel,
        currentContent: options.currentContent,
        targetContent: options.targetContent,
        onClose: () => dp?.destroy?.()
      })
  })
}
