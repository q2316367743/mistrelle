export interface ApiV1SkillsVersionsResult {
  slug: string
  source: string
  versions: Version[]
}

interface Version {
  changelog: string
  createdAt: number
  securityReports: SecurityReports
  version: string
  versionId: number
}

interface SecurityReports {
  keen: Keen
  sanbu: Keen
}

interface Keen {
  status: string
  statusText: string
  reportUrl: string
}

export const apiV1SkillsVersions = async (slug: string) => {
  const { data } = await window.preload.axios<ApiV1SkillsVersionsResult>({
    baseURL: `https://api.skillhub.cn`,
    url: `/api/v1/skills/${slug}/versions`,
    method: 'GET'
  })
  return data
}
