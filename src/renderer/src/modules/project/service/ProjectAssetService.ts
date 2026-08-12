import type { ChatFileRef } from '@/utils/chatSender'
import { buildProjectAssetDirPath } from './ProjectService'

export type ProjectAssetTreeNode = FileItem & { children?: ProjectAssetTreeNode[] }

/**
 * 递归读取项目资产目录，构建给资产表格使用的树结构。
 */
export const readProjectAssetTree = async (id: string): Promise<ProjectAssetTreeNode[]> => {
  const rootDir = buildProjectAssetDirPath(id)
  if (!window.preload.fs.existsSync(rootDir)) {
    await window.preload.fs.mkdir(rootDir)
  }
  return readAssetDir(rootDir)
}

export const flattenProjectAssetFiles = (
  nodes: ProjectAssetTreeNode[],
  rootDir: string
): ChatFileRef[] => {
  const result: ChatFileRef[] = []
  const walk = (items: ProjectAssetTreeNode[]) => {
    for (const item of items) {
      if (item.isDirectory) {
        if (item.children) walk(item.children)
        continue
      }
      if (!item.isFile) continue
      result.push({
        name: item.name,
        path: item.path,
        relativePath: relativeFromRoot(item.path, rootDir)
      })
    }
  }
  walk(nodes)
  return result.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

const readAssetDir = async (dir: string): Promise<ProjectAssetTreeNode[]> => {
  const items = await window.preload.fs.readDir(dir)
  const result: ProjectAssetTreeNode[] = []
  for (const item of items) {
    if (item.name.startsWith('.')) continue
    if (item.isDirectory) {
      result.push({ ...item, children: await readAssetDir(item.path) })
    } else if (item.isFile) {
      result.push({ ...item, children: undefined })
    }
  }
  return result
}

const relativeFromRoot = (filePath: string, rootDir: string): string => {
  const root = window.preload.path.resolve(rootDir)
  const full = window.preload.path.resolve(filePath)
  if (full === root) return window.preload.path.basename(full)
  const prefix = root.endsWith(window.preload.path.sep) ? root : `${root}${window.preload.path.sep}`
  return full.startsWith(prefix) ? full.slice(prefix.length).split(window.preload.path.sep).join('/') : full
}
