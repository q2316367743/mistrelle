import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import HumanizeDepthContent from './HumanizeDepthContent.vue'

export interface OpenHumanizeDepthOptions {
  /** 初始深度，默认 5 */
  defaultDepth?: number
  /** 确认后回调（depth 已钳制到 1~10） */
  onConfirm: (depth: number) => void
}

/**
 * 去 AI 味深度选择弹窗（命令式 DialogPlugin）：
 * 内容在 HumanizeDepthContent.vue，经 body: () => h(...) 渲染。
 */
export const openHumanizeDepth = (options: OpenHumanizeDepthOptions): void => {
  const dp = DialogPlugin({
    header: '选择改写深度',
    placement: 'center',
    width: '420px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(HumanizeDepthContent, {
        defaultDepth: options.defaultDepth ?? 5,
        onClose: () => dp?.destroy?.(),
        onConfirm: (depth: number) => {
          dp?.destroy?.()
          options.onConfirm(depth)
        }
      })
  })
}
