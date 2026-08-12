import { requestJson } from '@/plugin/http'
import { useSettingAccountStore } from '@/store'

export interface ApiV1SkillFileItem {
  path: string
  sha256: string
  size: number
}

export interface ApiV1SkillsFilesResult {
  count: number
  files: ApiV1SkillFileItem[]
  version: string
}

export const skillHubApiV1SkillsFiles = async (slug: string) => {
  const { data } = await requestJson<ApiV1SkillsFilesResult>({
    baseURL: 'https://api.skillhub.cn',
    url: `/api/v1/skills/${slug}/files`,
    method: 'GET',
    ...useSettingAccountStore().skillhubConfig
  })
  return data
}
