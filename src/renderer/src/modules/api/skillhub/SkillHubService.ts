import { apiV1Download } from './api/api-v1-download'
import type { SkillAgent } from '@/modules/skill'
import type HttpProgressEvent from '@/domain/HttpProgressEvent'

/**
 * 下载 Skill zip 并解压到指定 agent 的 skills 目录
 */
export const skillHubInstall = async (
  slug: string,
  agent: SkillAgent,
  options?: {
    overwrite?: boolean
    onDownloadProgress?: (progressEvent: HttpProgressEvent) => void
  }
): Promise<string> => {
  const join = window.preload.path.join
  const targetDir = join(agent.path, slug)

  if (window.preload.fs.existsSync(targetDir) && !options?.overwrite) {
    throw new Error(`目录 ${slug} 已存在，请先删除或选择覆盖`)
  }

  if (!window.preload.fs.existsSync(agent.path)) {
    await window.preload.fs.mkdir(agent.path)
  }

  if (window.preload.fs.existsSync(targetDir)) {
    await window.preload.fs.rm(targetDir)
  }

  const zipPath = join(
    window.preload.inject.os.getPath('temp'),
    `skillhub-${slug}-${Date.now()}.zip`
  )

  try {
    await apiV1Download(slug, zipPath, options?.onDownloadProgress)
    await window.preload.zip.extract(zipPath, targetDir)
  } finally {
    if (window.preload.fs.existsSync(zipPath)) {
      await window.preload.fs.rm(zipPath)
    }
  }

  return targetDir
}
