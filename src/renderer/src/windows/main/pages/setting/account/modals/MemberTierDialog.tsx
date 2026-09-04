/**
 * 会员档位列表弹窗外壳（命令式 DialogPlugin）：
 * MemberTierContent.vue 渲染账单列表式全宽档位行（当前档位高亮），经 body: () => h(...) 渲染进弹窗。
 */
import { DialogPlugin } from 'tdesign-vue-next'
import MemberTierContent from './MemberTierContent.vue'

export const openMemberTier = (tiers: AuthTierInfo[], currentTier: string | null): void => {
  const dp = DialogPlugin({
    header: '会员档位',
    placement: 'center',
    width: '560px',
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
