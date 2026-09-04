import { h } from 'vue'
import { DrawerPlugin } from 'tdesign-vue-next'
import CompareRecordDrawerContent from './CompareRecordDrawerContent.vue'
import type { CompareRecord } from '../compare-types'

/**
 * 对比记录详情抽屉（命令式 DrawerPlugin）：
 * 内容组件 CompareRecordDrawerContent.vue 承载任务摘要 + 四视图（总览 / 题集 / 身份一致性 / 日志）。
 */
export const openCompareRecord = (record: CompareRecord) => {
  const dp = DrawerPlugin({
    header: '对比记录详情',
    size: 'clamp(560px, 68%, 960px)',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(CompareRecordDrawerContent, {
        record,
        onClose: () => dp?.destroy?.()
      })
  })
}
