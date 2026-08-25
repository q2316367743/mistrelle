import { h } from 'vue'
import { DrawerPlugin } from 'tdesign-vue-next'
import HealthRecordDrawerContent from './HealthRecordDrawerContent.vue'

/**
 * 检测记录详情抽屉（命令式 DrawerPlugin）：
 * 内容组件 HealthRecordDrawerContent.vue 承载任务摘要 + 三视图（概览 / 报告 / 日志，footer: false）；
 * 重新生成报告由内容组件内部驱动（composable 单例），关闭经 onClose 通知外壳销毁。
 */
export const openHealthRecord = (record: HealthRecordInput) => {
  const dp = DrawerPlugin({
    header: '检测记录详情',
    size: 'clamp(520px, 64%, 860px)',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(HealthRecordDrawerContent, {
        record,
        onClose: () => dp?.destroy?.()
      })
  })
}
