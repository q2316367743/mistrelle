import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import LinkDialogContent from './LinkDialogContent.vue'

export interface OpenLinkDialogOptions {
  /** 光标处已有的链接地址（有则预填，便于修改）；无则视为新增 */
  currentHref?: string
  /** 确认后回调：href 为空串表示移除链接 */
  onConfirm: (href: string) => void
}

/**
 * 链接地址输入弹窗（命令式 DialogPlugin）：内容在 LinkDialogContent.vue，经 body: () => h(...) 渲染。
 */
export const openLinkDialog = (options: OpenLinkDialogOptions): void => {
  const dp = DialogPlugin({
    header: options.currentHref ? '编辑链接' : '插入链接',
    placement: 'center',
    width: '420px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(LinkDialogContent, {
        currentHref: options.currentHref ?? '',
        onClose: () => dp?.destroy?.(),
        onConfirm: (href: string) => {
          dp?.destroy?.()
          options.onConfirm(href)
        }
      })
  })
}
