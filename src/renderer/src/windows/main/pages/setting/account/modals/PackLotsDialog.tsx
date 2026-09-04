/**
 * 积分增量包账本弹窗外壳：展示各笔剩余与到期日，入口选 SKU。
 */
import { DialogPlugin } from 'tdesign-vue-next'
import PackLotsContent from './PackLotsContent.vue'

export const openPackLots = (): void => {
  const dp = DialogPlugin({
    header: '积分增量包',
    placement: 'center',
    width: '480px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(PackLotsContent, {
        onClose: () => dp?.destroy?.()
      })
  })
}
