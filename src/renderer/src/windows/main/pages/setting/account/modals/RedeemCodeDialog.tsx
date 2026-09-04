/**
 * 激活码弹窗外壳（命令式 DialogPlugin）：
 * RedeemCodeContent.vue 承载「验证 → 展示可激活内容 → 确认激活」流程与提交状态。
 */
import { DialogPlugin } from 'tdesign-vue-next'
import RedeemCodeContent from './RedeemCodeContent.vue'

export const openRedeemCode = (): void => {
  const dp = DialogPlugin({
    header: '激活码',
    placement: 'center',
    width: '440px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(RedeemCodeContent, {
        onClose: () => dp?.destroy?.(),
        onSuccess: () => dp?.destroy?.()
      })
  })
}
