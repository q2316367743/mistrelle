import { DrawerPlugin } from 'tdesign-vue-next'
import { AiDesignStyleForm, buildAiDesignStyleForm, toAiDesignStyleForm } from '@/entity'
import { useDesignStyleStore } from '@/windows/main/store'
import { MessageUtil } from '@/utils/modal'
import DesignStylePutContent from './DesignStylePutContent.vue'

/**
 * 设计风格新建 / 编辑抽屉外壳（命令式 DrawerPlugin）：
 * 内容组件 DesignStylePutContent.vue 承载表单与保存，经 body: () => h(...) 渲染进抽屉；
 * 操作按钮由内容组件内部提供（footer: false）。编辑时先读取完整内容再打开。
 */
export const openDesignStylePut = async (id?: string) => {
  const store = useDesignStyleStore()
  let form: AiDesignStyleForm
  let title = '新建设计风格'
  if (id) {
    const full = await store.getDetail(id)
    if (!full) {
      MessageUtil.error('未找到该设计风格')
      return
    }
    form = toAiDesignStyleForm(full)
    title = `编辑风格：${full.name}`
  } else {
    form = buildAiDesignStyleForm()
  }
  const dp = DrawerPlugin({
    header: title,
    size: '720px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(DesignStylePutContent, {
        form,
        styleId: id,
        onClose: () => dp?.destroy?.(),
        onSuccess: () => dp?.destroy?.()
      })
  })
}
