/**
 * 邮箱验证引导弹窗外壳（命令式 DialogPlugin）：
 * 登录 / 注册反馈「邮箱未验证」时打开，内容组件 VerifyEmailContent.vue 承载
 * 「前往邮箱验证 / 重新发送验证邮件 / 已完成验证后重新登录」操作
 * （footer: false，操作按钮由内容组件内部提供）。
 * password：登录表单刚输入的密码，供用户点「已完成验证」后用邮箱 + 密码直接重登。
 */
import { DialogPlugin } from 'tdesign-vue-next'
import VerifyEmailContent from './VerifyEmailContent.vue'

export const openVerifyEmail = (email: string, password?: string): void => {
  const dp = DialogPlugin({
    header: '验证邮箱',
    placement: 'center',
    width: '420px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(VerifyEmailContent, {
        email,
        password,
        onClose: () => dp?.destroy?.()
      })
  })
}
