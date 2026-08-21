import { DrawerPlugin } from 'tdesign-vue-next'
import SkillHubDetailContent from './SkillHubDetailContent.vue'
import type { ApiSkill } from '@/modules/api/skillhub'

/**
 * 查看 Skill 详情抽屉
 */
export const openSkillHubDetail = (skill: ApiSkill) => {
  DrawerPlugin({
    header: false,
    size: 'clamp(500px, 80%, 1200px)',
    footer: false,
    default: () => <SkillHubDetailContent skill={skill} />
  })
}
