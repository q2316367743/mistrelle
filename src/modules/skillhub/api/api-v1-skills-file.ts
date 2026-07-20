import { requestText } from '@/plugin/http'

/**
 * 获取技能指定文件内容（如 SKILL.md）
 * 接口可能 302 到 COS；若未跟随重定向则解析 HTML 中的链接再拉取
 */
export const skillHubApiV1SkillsFile = async (slug: string, path = 'SKILL.md') => {
  const { data } = await requestText({
    baseURL: 'https://api.skillhub.cn',
    url: `/api/v1/skills/${slug}/file`,
    method: 'GET',
    params: { path }
  })

  const trimmed = data.trim()
  if (trimmed.startsWith('<a href=')) {
    const match = trimmed.match(/href="([^"]+)"/)
    if (match?.[1]) {
      const res = await requestText({
        url: match[1],
        method: 'GET'
      })
      return res.data
    }
  }
  return data
}
