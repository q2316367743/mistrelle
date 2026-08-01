import type { LocalSkill } from '@/modules/skill'

export interface ChatFileRef {
  name: string
  path: string
  relativePath: string
}

export interface WorkspaceEntryRef extends ChatFileRef {
  isDirectory: boolean
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

/** 工作空间展示时需要排除的噪音目录/文件，避免列表被 node_modules 等淹没 */
const NOISE_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  '.cache',
  '.idea',
  '.vscode',
  '.DS_Store',
  'coverage',
  'build',
  'target',
  '__pycache__'
])

export const relativeFromRoot = (filePath: string, rootDir: string): string => {
  const root = window.preload.path.resolve(rootDir)
  const full = window.preload.path.resolve(filePath)
  if (full === root) return window.preload.path.basename(full)
  const prefix = root.endsWith(window.preload.path.sep) ? root : `${root}${window.preload.path.sep}`
  return full.startsWith(prefix) ? full.slice(prefix.length).split(window.preload.path.sep).join('/') : full
}

const readDirSafe = async (dir: string): Promise<FileItem[]> => {
  try {
    return await window.preload.fs.readDir(dir)
  } catch {
    return []
  }
}

/**
 * 按相对路径在工作空间内做「一级一层」的文件浏览：query 为空取根目录直接子项；
 * query 命中已存在目录则逐级下钻取其直接子项；未命中的剩余段作为该级目录名的前缀过滤。
 * 仅返回该层的直接子项，避免递归扫描大目录导致页面卡顿。
 */
export const listWorkspaceEntries = async (
  workspace: string,
  query: string
): Promise<WorkspaceEntryRef[]> => {
  const parts = query.split('/').filter((p) => p)
  let baseDir = workspace
  let entries = await readDirSafe(baseDir)
  let filterPrefix = ''
  for (const part of parts) {
    const dir = entries.find((item) => item.isDirectory && item.name === part)
    if (dir) {
      baseDir = dir.path
      entries = await readDirSafe(baseDir)
    } else {
      filterPrefix = part
      break
    }
  }
  return entries
    .filter(
      (item) =>
        (item.isDirectory || item.isFile) &&
        !NOISE_NAMES.has(item.name) &&
        !item.name.startsWith('.')
    )
    .filter((item) => !filterPrefix || item.name.toLowerCase().startsWith(filterPrefix.toLowerCase()))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .map<WorkspaceEntryRef>((item) => ({
      name: item.name,
      path: item.path,
      relativePath: relativeFromRoot(item.path, workspace),
      isDirectory: item.isDirectory
    }))
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
