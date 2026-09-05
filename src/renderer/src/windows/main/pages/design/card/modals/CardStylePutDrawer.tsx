import { h } from 'vue'
import { DrawerPlugin } from 'tdesign-vue-next'
import { AiCardStyleForm, buildAiCardStyleForm } from '@/entity'
import { useCardStyleStore } from '@/windows/main/store'
import { MessageUtil } from '@/utils/modal'
import CardStylePutDrawerContent from './CardStylePutDrawerContent.vue'

/**
 * 卡片风格新建 / 编辑抽屉外壳（命令式 DrawerPlugin）：
 * 内容组件 CardStylePutDrawerContent.vue 承载表单与保存，经 body: () => h(...) 渲染进抽屉；
 * 操作按钮由内容组件内部提供（footer: false）。
 * 卡片风格索引项即完整数据（props 全量），编辑直接从 store 取，无需读单条文件。
 */
export const openCardStylePut = async (id?: string) => {
  const store = useCardStyleStore()
  let form: AiCardStyleForm
  let title = '新建卡片风格'
  if (id) {
    const target = store.getById(id)
    if (!target) {
      MessageUtil.error('未找到该卡片风格')
      return
    }
    form = {
      name: target.name,
      description: target.description,
      tags: [...target.tags],
      props: { ...target.props }
    }
    title = `编辑风格：${target.name}`
  } else {
    form = buildAiCardStyleForm()
  }
  const dp = DrawerPlugin({
    header: title,
    size: '780px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(CardStylePutDrawerContent, {
        form,
        styleId: id,
        onClose: () => dp?.destroy?.(),
        onSuccess: () => dp?.destroy?.()
      })
  })
}
