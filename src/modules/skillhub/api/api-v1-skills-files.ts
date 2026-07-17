export interface ApiV1SkillsFilesResult {
  count: number
  files: File[]
  version: string
}

interface File {
  path: string
  sha256: string
  size: number
}

export const skillHubApiV1SkillsFiles = async (slug: string) => {
  const { data } = await window.preload.axios<ApiV1SkillsFilesResult>({
    baseURL: 'https://api.skillhub.cn',
    url: `/api/v1/skills/${slug}/files`,
    method: 'GET'
  })
  return data
}
