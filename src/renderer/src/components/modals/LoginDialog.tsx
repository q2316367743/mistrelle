/**
 * 登录 / 注册弹窗外壳（命令式 DialogPlugin）：
 * 内容组件 LoginContent.vue 承载表单与提交状态，经 body: () => h(...) 渲染进弹窗；
 * 操作按钮由内容组件内部提供（footer: false）。
 */
import { DialogPlugin } from 'tdesign-vue-next'
import LoginContent from './LoginContent.vue'

export const openLogin = (): void => {
  const dp = DialogPlugin({
    header: '登录 / 注册',
    placement: 'center',
    width: '420px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(LoginContent, {
        onClose: () => dp?.destroy?.(),
        onSuccess: () => dp?.destroy?.()
      })
  })
}