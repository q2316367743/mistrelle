import { getAppData2Project } from '@/global/Constant'
import { Project } from '@/entity'

export const buildProjectIndexPath = () =>
  window.preload.path.join(getAppData2Project(), 'index.json')

export const buildProjectDirPath = (id: string) =>
  window.preload.path.join(getAppData2Project(), id)

export const buildProjectDynamicsPath = (id: string) =>
  window.preload.path.join(buildProjectDirPath(id), 'dynamics.json')

export const projectList = async (): Promise<Array<Project>> => {
  const folder = getAppData2Project()
  const indexPath = buildProjectIndexPath()
  if (!window.preload.fs.existsSync(folder)) {
    await window.preload.fs.mkdir(folder)
    await window.preload.fs.writeTextFile(indexPath, JSON.stringify([]))
    return []
  }
  if (!window.preload.fs.existsSync(indexPath)) {
    await window.preload.fs.writeTextFile(indexPath, JSON.stringify([]))
    return []
  }
  return JSON.parse(await window.preload.fs.readTextFile(indexPath))
}

export const projectListSave = async (list: Array<Project>) => {
  await window.preload.fs.writeTextFile(buildProjectIndexPath(), JSON.stringify(list))
}

export const projectGet = async (id: string): Promise<Project | undefined> => {
  const list = await projectList()
  return list.find((e) => e.id === id)
}

/**
 * 新建项目时建立子目录骨架：files / chat / tasks 与 dynamics.json
 */
export const projectCreateSkeleton = async (id: string) => {
  const dir = buildProjectDirPath(id)
  await window.preload.fs.mkdir(dir, true)
  await Promise.all([
    window.preload.fs.mkdir(window.preload.path.join(dir, 'files')),
    window.preload.fs.mkdir(window.preload.path.join(dir, 'chat')),
    window.preload.fs.mkdir(window.preload.path.join(dir, 'tasks'))
  ])
  await window.preload.fs.writeTextFile(buildProjectDynamicsPath(id), JSON.stringify([]))
}

export const projectRemove = async (id: string) => {
  await window.preload.fs.rm(buildProjectDirPath(id))
}
