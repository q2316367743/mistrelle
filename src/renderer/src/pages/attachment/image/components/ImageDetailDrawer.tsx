import { h } from 'vue'
import { DrawerPlugin } from 'tdesign-vue-next'
import ImageDetailDrawerContent from './ImageDetailDrawerContent.vue'

/**
 * 图片详情抽屉（命令式 DrawerPlugin）：
 * 内容组件 ImageDetailDrawerContent.vue 承载大图 / 提示词 / 操作按钮（footer: false）；
 * onRetry / onDeleted 透传给页面层驱动重试与删除（删除后即时关闭抽屉）
 */
export const openImageDetail = (
  record: ImageRecordInput,
  handlers: { onRetry: (record: ImageRecordInput) => void; onDeleted: (id: string) => void }
) => {
  const dp = DrawerPlugin({
    header: '图片详情',
    size: 'clamp(420px, 58%, 720px)',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(ImageDetailDrawerContent, {
        record,
        onRetry: (r: ImageRecordInput) => handlers.onRetry(r),
        onDeleted: (id: string) => {
          handlers.onDeleted(id)
          dp?.destroy?.()
        },
        onClose: () => dp?.destroy?.()
      })
  })
}