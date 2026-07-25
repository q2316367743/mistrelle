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

export const isPathUnder = (filePath: string, dir: string): boolean => {
  if (!dir) return false
  const normalizedPath = window.preload.path.resolve(filePath)
  const normalizedDir = window.preload.path.resolve(dir)
  return normalizedPath.startsWith(normalizedDir + window.preload.path.sep) || normalizedPath === normalizedDir
}

export const copyToInputs = async (filePath: string, sandboxDir: string): Promise<string> => {
  const inputsDir = window.preload.path.join(sandboxDir, 'inputs')
  const name = filePath.split('/').pop() || filePath.split('\\').pop() || 'file'
  let dest = window.preload.path.join(inputsDir, name)
  if (window.preload.fs.existsSync(dest)) {
    const extIdx = name.lastIndexOf('.')
    const base = extIdx > 0 ? name.slice(0, extIdx) : name
    const ext = extIdx > 0 ? name.slice(extIdx) : ''
    let i = 1
    while (window.preload.fs.existsSync(dest)) {
      dest = window.preload.path.join(inputsDir, `${base}_${i}${ext}`)
      i++
    }
  }
  await window.preload.fs.copyFile(filePath, dest)
  return dest
}
