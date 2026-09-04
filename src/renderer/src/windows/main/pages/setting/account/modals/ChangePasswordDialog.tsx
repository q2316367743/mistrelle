/**
 * 修改密码弹窗外壳（命令式 DialogPlugin）：
 * ChangePasswordContent.vue 承载表单与提交状态，经 body: () => h(...) 渲染进弹窗。
 */
import { DialogPlugin } from 'tdesign-vue-next'
import ChangePasswordContent from './ChangePasswordContent.vue'

export const openChangePassword = (): void => {
  const dp = DialogPlugin({
    header: '修改密码',
    placement: 'center',
    width: '400px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(ChangePasswordContent, {
        onClose: () => dp?.destroy?.(),
        onSuccess: () => dp?.destroy?.()
      })
  })
}