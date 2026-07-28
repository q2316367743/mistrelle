import type { ProjectPlan } from '@/entity/project/ProjectPlan'
import { buildProjectDirPath } from './ProjectService'

/**
 * 计划索引条目：与 ProjectPlan 同构，便于列表渲染直接当作完整计划使用；
 * plan.json 仍然存完整数据作为数据源兜底
 */
export type ProjectPlanIndexItem = ProjectPlan

// ~/.mistrelle/project/{id}/plan
export const buildProjectPlanDir = (id: string) =>
  window.preload.path.join(buildProjectDirPath(id), 'plan')

// ~/.mistrelle/project/{id}/plan/index.json
export const buildProjectPlanIndexPath = (id: string) =>
  window.preload.path.join(buildProjectPlanDir(id), 'index.json')

// ~/.mistrelle/project/{id}/plan/{planId}/plan.json
export const buildProjectPlanItemPath = (id: string, planId: string) =>
  window.preload.path.join(buildProjectPlanDir(id), planId, 'plan.json')

// ~/.mistrelle/project/{id}/plan/{planId}/files
export const buildProjectPlanFilesDir = (id: string, planId: string) =>
  window.preload.path.join(buildProjectPlanDir(id), planId, 'files')

const ensurePlanDir = async (id: string) => {
  const dir = buildProjectPlanDir(id)
  if (!window.preload.fs.existsSync(dir)) {
    await window.preload.fs.mkdir(dir, true)
  }
  return dir
}

const toIndexItem = (p: ProjectPlan): ProjectPlanIndexItem => ({ ...p, tags: [...p.tags] })

/**
 * 读取计划索引：自动确保目录与索引文件存在
 */
export const projectPlanList = async (id: string): Promise<ProjectPlanIndexItem[]> => {
  await ensurePlanDir(id)
  const indexPath = buildProjectPlanIndexPath(id)
  if (!window.preload.fs.existsSync(indexPath)) {
    await window.preload.fs.writeTextFile(indexPath, JSON.stringify([]))
    return []
  }
  return JSON.parse(await window.preload.fs.readTextFile(indexPath))
}

const projectPlanIndexSave = async (id: string, list: ProjectPlanIndexItem[]) => {
  await ensurePlanDir(id)
  await window.preload.fs.writeTextFile(buildProjectPlanIndexPath(id), JSON.stringify(list))
}

/**
 * 读取单条计划详情；子文件不存在时返回 undefined
 */
export const projectPlanGet = async (
  id: string,
  planId: string
): Promise<ProjectPlan | undefined> => {
  const p = buildProjectPlanItemPath(id, planId)
  if (!window.preload.fs.existsSync(p)) return undefined
  return JSON.parse(await window.preload.fs.readTextFile(p))
}

/**
 * 新建计划：建子目录、plan.json、files/，再写索引
 */
export const projectPlanAdd = async (id: string, plan: ProjectPlan) => {
  const planDir = window.preload.path.join(buildProjectPlanDir(id), plan.id)
  await window.preload.fs.mkdir(planDir, true)
  await window.preload.fs.mkdir(buildProjectPlanFilesDir(id, plan.id), true)
  await window.preload.fs.writeTextFile(buildProjectPlanItemPath(id, plan.id), JSON.stringify(plan))
  const list = await projectPlanList(id)
  list.push(toIndexItem(plan))
  await projectPlanIndexSave(id, list)
  return plan
}

/**
 * 更新计划：写 plan.json 并刷新索引摘要
 */
export const projectPlanUpdate = async (id: string, plan: ProjectPlan) => {
  const planDir = window.preload.path.join(buildProjectPlanDir(id), plan.id)
  if (!window.preload.fs.existsSync(planDir)) {
    await window.preload.fs.mkdir(planDir, true)
    await window.preload.fs.mkdir(buildProjectPlanFilesDir(id, plan.id), true)
  }
  await window.preload.fs.writeTextFile(buildProjectPlanItemPath(id, plan.id), JSON.stringify(plan))
  const list = await projectPlanList(id)
  const idx = list.findIndex((e) => e.id === plan.id)
  if (idx >= 0) list[idx] = toIndexItem(plan)
  else list.push(toIndexItem(plan))
  await projectPlanIndexSave(id, list)
}

/**
 * 删除计划：连同子目录 rm，并清理索引
 */
export const projectPlanRemove = async (id: string, planId: string) => {
  const planDir = window.preload.path.join(buildProjectPlanDir(id), planId)
  if (window.preload.fs.existsSync(planDir)) {
    await window.preload.fs.rm(planDir)
  }
  const list = await projectPlanList(id)
  await projectPlanIndexSave(
    id,
    list.filter((e) => e.id !== planId)
  )
}

/**
 * 读取计划附件目录顶层内容，自动确保 files 目录存在
 */
export const projectPlanListFiles = async (
  id: string,
  planId: string
): Promise<Array<FileItem>> => {
  const dir = buildProjectPlanFilesDir(id, planId)
  if (!window.preload.fs.existsSync(dir)) {
    await window.preload.fs.mkdir(dir)
  }
  return window.preload.fs.readDir(dir)
}
