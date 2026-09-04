/**
 * 修改用户名弹窗外壳（命令式 DialogPlugin）：
 * EditNameContent.vue 承载输入与提交状态，经 body: () => h(...) 渲染进弹窗；
 * 操作按钮由内容组件内部提供（footer: false）。
 */
import { DialogPlugin } from 'tdesign-vue-next'
import EditNameContent from './EditNameContent.vue'

export const openEditName = (currentName: string): void => {
  const dp = DialogPlugin({
    header: '修改用户名',
    placement: 'center',
    width: '400px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(EditNameContent, {
        currentName,
        onClose: () => dp?.destroy?.(),
        onSuccess: () => dp?.destroy?.()
      })
  })
}