/**
 * 增量包选择弹窗外壳：列出可购 SKU，点选后进入结算确认。
 */
import { DialogPlugin } from 'tdesign-vue-next'
import PackSelectContent from './PackSelectContent.vue'
import { openPackCheckout } from './PackCheckoutDialog'

export const openPackSelect = (catalog: AuthPackCatalog): void => {
  const dp = DialogPlugin({
    header: '选择增量包',
    placement: 'center',
    width: '540px',
    destroyOnClose: true,
    confirmBtn: '关闭',
    cancelBtn: null,
    body: () =>
      h(PackSelectContent, {
        catalog,
        onClose: () => dp?.destroy?.(),
        onPick: (pack: AuthPackInfo) => {
          openPackCheckout(pack, () => dp?.destroy?.())
        }
      })
  })
}
