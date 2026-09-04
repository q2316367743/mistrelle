/**
 * 邮箱验证引导弹窗外壳（命令式 DialogPlugin）：
 * 登录 / 注册反馈「邮箱未验证」时打开，内容组件 VerifyEmailContent.vue 承载
 * 「前往邮箱验证 / 重新发送验证邮件」操作（footer: false，操作按钮由内容组件内部提供）。
 */
import { DialogPlugin } from 'tdesign-vue-next'
import VerifyEmailContent from './VerifyEmailContent.vue'

export const openVerifyEmail = (email: string): void => {
  const dp = DialogPlugin({
    header: '验证邮箱',
    placement: 'center',
    width: '420px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(VerifyEmailContent, {
        email,
        onClose: () => dp?.destroy?.()
      })
  })
}
