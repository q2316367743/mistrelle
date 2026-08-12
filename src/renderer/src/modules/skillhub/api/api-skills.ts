import { requestJson } from '@/plugin/http'
import type { SkillHubResult } from '../types'
import { useSettingAccountStore } from '@/store'

export interface ApiSkillsParam {
  page: number
  pageSize: number
  keyword?: string
  category?: string
  sortBy?: string
  order?: string
}

export interface ApiSkillsResult {
  skills: ApiSkill[]
  total: number
}

export interface ApiSkill {
  category: string
  claim_state: string
  claimable: boolean
  claimed_user_handle?: any
  created_at: number
  description: string
  description_zh: string
  downloads: number
  homepage: string
  iconUrl: string
  installs: number
  labels: Labels
  last_synced_at?: number
  name: string
  ownerName: string
  score: Score | number
  slug: string
  source: string
  stars: number
  subCategories: SubCategory[]
  tags?: string[]
  updated_at: number
  upstream_owner_login?: string
  upstream_url?: string
  verified: boolean
  version: string
  publisher?: Publisher
}

interface Publisher {
  name: string
  logoUrl?: any
  verified: boolean
  certifiedName: string
  orgId: string
}

interface SubCategory {
  key: string
  name: string
}

interface Score {
  s: number
  e: number
  c: number[]
}

interface Labels {
  requires_api_key: string
}

/**
 * 获取技能列表
 * @param params
 */
export const skillHubApiSkills = async (params: ApiSkillsParam) => {
  const resp = await requestJson<SkillHubResult<ApiSkillsResult>>({
    baseURL: 'https://api.skillhub.cn',
    url: '/api/skills',
    method: 'GET',
    params: params,
    ...useSettingAccountStore().skillhubConfig
  })
  return resp.data.data
}
