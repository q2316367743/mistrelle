import { DrawerPlugin } from 'tdesign-vue-next'
import PointsLedgerContent from './PointsLedgerContent.vue'

/**
 * 积分流水分页抽屉（命令式 DrawerPlugin）：
 * 内容组件 PointsLedgerContent.vue 拉 GET /api/user/transactions 并展示表格 + 分页。
 */
export const openPointsLedger = (): void => {
  const dp = DrawerPlugin({
    header: '我的积分',
    size: '800px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(PointsLedgerContent, {
        onClose: () => dp?.destroy?.()
      })
  })
}
