import { requestJson } from '@/plugin/http'
import { useSettingAccountStore } from '@/store'

/**
 * 获取文件信息
 * @param orgId 所属组织
 * @param slug 技能slug
 * @param version 版本号
 * @param fileName 文件名
 */
export const orgsOrgSlugVersionFiles = async (
  orgId: string,
  slug: string,
  version: string,
  fileName: string
) => {
  const { data } = await requestJson<string>({
    method: 'GET',
    baseURL: 'https://api.skillhub.cn',
    url: `/orgs/${orgId}/${slug}/${version}/files/${fileName}`,
    ...useSettingAccountStore().skillhubConfig
  })
  return data
}
