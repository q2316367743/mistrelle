import { h } from 'vue'
import { DrawerPlugin } from 'tdesign-vue-next'
import { useCardStyleStore } from '@/windows/main/store'
import { MessageUtil } from '@/utils/modal'
import CardStyleDetailDrawerContent from './CardStyleDetailDrawerContent.vue'

/**
 * 卡片风格查看抽屉外壳（命令式 DrawerPlugin）：
 * 无详情路由，点击卡片直接开抽屉；编辑 / 删除等操作由内容组件内部提供（footer: false）。
 */
export const openCardStyleDetail = (id: string) => {
  const store = useCardStyleStore()
  const target = store.getById(id)
  if (!target) {
    MessageUtil.error('未找到该卡片风格')
    return
  }
  const dp = DrawerPlugin({
    header: `卡片风格：${target.name}`,
    size: '560px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(CardStyleDetailDrawerContent, {
        styleId: id,
        onClose: () => dp?.destroy?.()
      })
  })
}
