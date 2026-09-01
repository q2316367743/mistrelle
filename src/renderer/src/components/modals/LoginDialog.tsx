/**
 * 登录 / 注册弹窗外壳（命令式 DialogPlugin）：
 * 内容组件 LoginContent.vue 承载表单与提交状态，经 body: () => h(...) 渲染进弹窗；
 * 操作按钮由内容组件内部提供（footer: false）。
 * onSuccess：登录成功后回调（用于「登录成功回设置页」等场景，缺省仅关闭弹窗）；
 * onCancel：用户主动关闭弹窗（未登录）时回调（用于「未登录返回首页」等场景）。
 */
import { DialogPlugin } from 'tdesign-vue-next'
import LoginContent from './LoginContent.vue'

export const openLogin = (onSuccess?: () => void, onCancel?: () => void): void => {
  const dp = DialogPlugin({
    header: '登录 / 注册',
    placement: 'center',
    width: '420px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(LoginContent, {
        onClose: () => {
          dp?.destroy?.()
          onCancel?.()
        },
        onSuccess: () => {
          dp?.destroy?.()
          onSuccess?.()
        }
      })
  })
}