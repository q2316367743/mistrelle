/**
 * 会员与积分弹窗外壳（命令式 DialogPlugin）：
 * MemberTierContent.vue 渲染 Tab 容器（会员档位 / 积分增量包 同级），经 body: () => h(...) 渲染进弹窗。
 */
import { DialogPlugin } from 'tdesign-vue-next'
import MemberTierContent from './MemberTierContent.vue'

export const openMemberTier = (tiers: AuthTierInfo[], currentTier: string | null): void => {
  const dp = DialogPlugin({
    header: '会员与积分',
    placement: 'center',
    width: '640px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(MemberTierContent, {
        tiers,
        currentTier,
        onClose: () => dp?.destroy?.()
      })
  })
}
