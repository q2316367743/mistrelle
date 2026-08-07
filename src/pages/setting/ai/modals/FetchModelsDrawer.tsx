import { h } from 'vue'
import { DrawerPlugin } from 'tdesign-vue-next'
import type { AiModel } from '@/entity'
import FetchModelsContent from './FetchModelsContent.vue'

/**
 * 选择要导入的模型抽屉外壳（命令式 DrawerPlugin）：
 * 内容组件 FetchModelsContent.vue 承载搜索/分组/标签与「导入选中」，
 * 经 body: () => h(...) 渲染进抽屉；操作按钮由内容组件内部提供（footer: false）。
 */
export const fetchModelsDrawer = (
  fetchedModels: Array<{ id: string; name: string }>,
  existingModels: AiModel[],
  onConfirm: (selectedIds: string[]) => void | Promise<void>
) => {
  const dp = DrawerPlugin({
    header: '选择要导入的模型',
    size: '400px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(FetchModelsContent, {
        fetchedModels,
        existingModels,
        onClose: () => dp?.destroy?.(),
        onSuccess: async (ids: string[]) => {
          await onConfirm(ids)
          dp?.destroy?.()
        }
      })
  })
}
