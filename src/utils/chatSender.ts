import type { LocalSkill } from '@/modules/skill'

export interface ChatFileRef {
  name: string
  path: string
  relativePath: string
}

export const matchKeyword = (text: string, keyword: string) => text.toLowerCase().includes(keyword)

export const formatSkillDescription = (skill: LocalSkill) =>
  skill.description.replace(/^\s*\|\s*/, '').trim()

export const loadChatFiles = async (rootDir: string): Promise<ChatFileRef[]> => {
  const result: ChatFileRef[] = []
  const walk = async (dir: string, relative: string) => {
    if (!window.preload.fs.existsSync(dir)) return
    const items = await window.preload.fs.readDir(dir)
    for (const item of items) {
      const fullPath = window.preload.path.join(dir, item.name)
      const relativePath = relative ? `${relative}/${item.name}` : item.name
      if (item.isDirectory) await walk(fullPath, relativePath)
      else if (item.isFile) result.push({ name: item.name, path: fullPath, relativePath })
    }
  }
  await walk(rootDir, '')
  return result.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}
