/**
 * 增量包结算确认弹窗外壳：展示所选 SKU，不对接支付。
 */
import { DialogPlugin } from 'tdesign-vue-next'
import PackCheckoutContent from './PackCheckoutContent.vue'
import { openRedeemCode } from './RedeemCodeDialog'

export const openPackCheckout = (pack: AuthPackInfo, onLeaveSelect?: () => void): void => {
  const dp = DialogPlugin({
    header: '确认增量包',
    placement: 'center',
    width: '440px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(PackCheckoutContent, {
        pack,
        onClose: () => dp?.destroy?.(),
        onRedeem: () => {
          dp?.destroy?.()
          onLeaveSelect?.()
          openRedeemCode()
        }
      })
  })
}
