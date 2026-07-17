export interface ApiV1SkillsResult {
  contentZhAvailable: boolean
  latestVersion: LatestVersion
  owner: Owner
  publisher: Publisher
  securityReports: SecurityReports
  skill: Skill
}

interface Skill {
  authorVerifiedHandle?: any
  category: string
  claim_state: string
  claimable: boolean
  claimed_user_handle?: any
  createdAt: number
  displayName: string
  githubAuthorLogin?: any
  iconUrl: string
  isAuthorVerified: boolean
  labels: Labels
  last_synced_at?: any
  slug: string
  source: string
  sourceUrl?: any
  stats: Stats
  subCategories: SubCategory[]
  summary: string
  summary_zh: string
  tags: Tags
  updatedAt: number
  upstream_owner_login?: any
  upstream_url?: any
  verified: boolean
}

interface Tags {
  latest: string
}

interface SubCategory {
  key: string
  name: string
}

interface Stats {
  comments: number
  downloads: number
  installs: number
  stars: number
  versions: number
}

interface Labels {
  requires_api_key: string
}

interface SecurityReports {
  keen: Keen
  sanbu: Keen
}

interface Keen {
  reportUrl: string
  status: string
  statusText: string
}

interface Publisher {
  name: string
  logoUrl?: any
  verified: boolean
  certifiedName: string
  orgId: string
}

interface Owner {
  displayName: string
  handle: string
  image?: any
}

interface LatestVersion {
  changelog: string
  createdAt: number
  version: string
}

/**
 * 获取技能详情
 * @param slug 技能slug
 */
export const skillHubApiV1SkillsInfo = async (slug: string) => {
  const { data } = await window.preload.axios<ApiV1SkillsResult>({
    baseURL: `https://api.skillhub.cn`,
    url: `/api/v1/skills/${slug}`,
    method: 'GET'
  })
  return data
}
