import { requestJson } from '@/plugin/http'
import { useSettingAccountStore } from '@/store'

export interface ApiV1SkillVersionItem {
  changelog: string
  createdAt: number
  securityReports: SecurityReports
  version: string
  versionId: number
}

export interface ApiV1SkillsVersionsResult {
  slug: string
  source: string
  versions: ApiV1SkillVersionItem[]
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
  const { data } = await requestJson<ApiV1SkillsVersionsResult>({
    baseURL: `https://api.skillhub.cn`,
    url: `/api/v1/skills/${slug}/versions`,
    method: 'GET',
    ...useSettingAccountStore().skillhubConfig
  })
  return data
}
