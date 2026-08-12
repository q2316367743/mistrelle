import type { ProjectPlan, ProjectPlanLog } from '@/entity/project/ProjectPlan'
import { buildProjectDirPath } from './ProjectService'
import { useSnowflake } from '@/hooks'
import {
  PLAN_PRIORITY_META,
  PLAN_STATUS_META
} from '@/modules/project/const/ProjectPlanConst'

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

// ~/.mistrelle/project/{id}/plan/{planId}/logs.json
export const buildProjectPlanLogPath = (id: string, planId: string) =>
  window.preload.path.join(buildProjectPlanDir(id), planId, 'logs.json')

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

// --------------------------------- 日志 ---------------------------------

/**
 * 读取计划日志列表；文件不存在时自动创建并返回空数组
 */
export const projectPlanLogList = async (
  id: string,
  planId: string
): Promise<ProjectPlanLog[]> => {
  const p = buildProjectPlanLogPath(id, planId)
  if (!window.preload.fs.existsSync(p)) {
    await window.preload.fs.writeTextFile(p, JSON.stringify([]))
    return []
  }
  return JSON.parse(await window.preload.fs.readTextFile(p))
}

/**
 * 追加一条计划日志并写回
 */
export const projectPlanLogAppend = async (
  id: string,
  planId: string,
  log: ProjectPlanLog
): Promise<ProjectPlanLog[]> => {
  const list = await projectPlanLogList(id, planId)
  list.push(log)
  await window.preload.fs.writeTextFile(buildProjectPlanLogPath(id, planId), JSON.stringify(list))
  return list
}

const sameStringArray = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

/**
 * 按 before→after 自动产出差异日志（不含变更人；仅追踪右栏 5 字段）
 * 纯函数：仅构造日志对象，不落盘
 */
export const buildProjectPlanUpdateLog = (
  before: ProjectPlan,
  after: ProjectPlan
): ProjectPlanLog[] => {
  const logs: ProjectPlanLog[] = []
  const now = Date.now()
  const sid = useSnowflake().nextId().toString()
  const mk = (
    type: ProjectPlanLog['type'],
    description: string,
    meta?: ProjectPlanLog['meta']
  ): ProjectPlanLog => ({
    id: sid + '_' + logs.length,
    type,
    description,
    meta,
    createdAt: now,
    updatedAt: now
  })

  if (before.status !== after.status) {
    logs.push(
      mk(
        'status',
        `修改状态：${PLAN_STATUS_META[before.status].label} → ${PLAN_STATUS_META[after.status].label}`,
        { field: 'status', from: before.status, to: after.status }
      )
    )
  }
  if (before.priority !== after.priority) {
    logs.push(
      mk(
        'priority',
        `修改优先级：${PLAN_PRIORITY_META[before.priority].label} → ${PLAN_PRIORITY_META[after.priority].label}`,
        { field: 'priority', from: before.priority, to: after.priority }
      )
    )
  }
  if (before.startDate !== after.startDate) {
    logs.push(
      mk(
        'date',
        `修改开始日期：${before.startDate || '未设置'} → ${after.startDate || '未设置'}`,
        { field: 'startDate', from: before.startDate, to: after.startDate }
      )
    )
  }
  if (before.endDate !== after.endDate) {
    logs.push(
      mk(
        'date',
        `修改截止日期：${before.endDate || '未设置'} → ${after.endDate || '未设置'}`,
        { field: 'endDate', from: before.endDate, to: after.endDate }
      )
    )
  }
  if (!sameStringArray(before.tags, after.tags)) {
    logs.push(
      mk(
        'tags',
        `修改标签：${before.tags.length ? before.tags.join('、') : '未设置'} → ${
          after.tags.length ? after.tags.join('、') : '未设置'
        }`,
        { field: 'tags', from: before.tags.join(','), to: after.tags.join(',') }
      )
    )
  }

  return logs
}
