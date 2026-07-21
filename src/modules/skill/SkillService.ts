import { KeyValueUtil } from '@/utils/native/KeyValueUtil'
import { LocalSkill, LocalSkillFile, LocalSkillForm, SkillAgent } from './types'
import { cloneDeep } from 'es-toolkit'

const SKILL_FILE = 'SKILL.md'
const AGENT_STORAGE_KEY = 'skill/agents'

/**
 * 默认的 agent skills 目录
 */
export const buildDefaultSkillAgents = (): Array<SkillAgent> => {
  const home = window.preload.inject.os.getPath('home')
  const join = window.preload.path.join
  return [
    { key: 'system', name: '系统默认', path: join(home, '.agents', 'skills') },
    { key: 'claude', name: 'Claude Code', path: join(home, '.claude', 'skills') },
    { key: 'opencode', name: 'OpenCode', path: join(home, '.config', 'opencode', 'skills') },
    { key: 'workbuddy', name: 'WorkBuddy', path: join(home, '.workbuddy', 'skills') }
  ]
}

/**
 * 获取 agent 列表（含用户自定义）
 */
export const skillAgentList = (): Array<SkillAgent> => {
  const saved = KeyValueUtil.getItem<Array<SkillAgent>>(AGENT_STORAGE_KEY)
  if (saved && saved.length > 0) return saved
  return buildDefaultSkillAgents()
}

/**
 * 保存 agent 列表
 */
export const skillAgentSave = (agents: Array<SkillAgent>) => {
  KeyValueUtil.setItem(AGENT_STORAGE_KEY, cloneDeep(agents))
}

export const buildSkillDirPath = (agent: SkillAgent, dirName: string) =>
  window.preload.path.join(agent.path, dirName)

export const buildSkillFilePath = (agent: SkillAgent, dirName: string) =>
  window.preload.path.join(buildSkillDirPath(agent, dirName), SKILL_FILE)

interface SkillMeta {
  name: string
  description: string
  body: string
}

/**
 * 解析 SKILL.md，拆出 frontmatter 与正文
 */
const parseSkillMd = (content: string): SkillMeta => {
  const meta: SkillMeta = { name: '', description: '', body: content }
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/)
  if (!match) return meta
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (key === 'name') meta.name = value
    else if (key === 'description') meta.description = value
  }
  meta.body = match[2]
  return meta
}

const buildSkillMd = (name: string, description: string, body: string) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`

const listAgentSkills = async (agent: SkillAgent): Promise<Array<LocalSkill>> => {
  if (!window.preload.fs.existsSync(agent.path)) return []
  const items = await window.preload.fs.readDir(agent.path)
  const list: Array<LocalSkill> = []
  for (const item of items) {
    if (!item.isDirectory) continue
    let name = item.name
    let description = ''
    const filePath = buildSkillFilePath(agent, item.name)
    if (window.preload.fs.existsSync(filePath)) {
      const meta = parseSkillMd(await window.preload.fs.readTextFile(filePath))
      name = meta.name || item.name
      description = meta.description
    }
    list.push({
      dirName: item.name,
      name,
      description,
      path: buildSkillDirPath(agent, item.name),
      agentKey: agent.key,
      agentName: agent.name,
      updatedAt: item.mtime
    })
  }
  return list
}

let _skillCache: Array<LocalSkill> | null = null

/**
 * 清除本地 Skill 缓存
 */
export const localSkillCacheClear = () => {
  _skillCache = null
}

/**
 * 获取本地 Skill 列表，传入 agentKey 时只扫描指定 agent
 */
export const localSkillList = async (agentKey?: string, forceRefresh = false): Promise<Array<LocalSkill>> => {
  if (!forceRefresh && _skillCache) {
    return agentKey ? _skillCache.filter((e) => e.agentKey === agentKey) : _skillCache
  }
  const agents = skillAgentList().filter((e) => !agentKey || e.key === agentKey)
  const result = await Promise.all(agents.map((agent) => listAgentSkills(agent)))
  _skillCache = result.flat().sort((a, b) => b.updatedAt - a.updatedAt)
  if (agentKey) return _skillCache.filter((e) => e.agentKey === agentKey)
  return _skillCache
}

/**
 * 新建本地 Skill
 */
export const localSkillCreate = async (agent: SkillAgent, form: LocalSkillForm) => {
  const dir = buildSkillDirPath(agent, form.dirName)
  if (window.preload.fs.existsSync(dir)) {
    throw new Error(`目录 ${form.dirName} 已存在`)
  }
  await window.preload.fs.mkdir(dir)
  await window.preload.fs.writeTextFile(
    buildSkillFilePath(agent, form.dirName),
    buildSkillMd(form.name, form.description, `# ${form.name}\n\n在此编写 Skill 的具体指令。\n`)
  )
}

/**
 * 更新本地 Skill 信息，保留正文
 */
export const localSkillUpdate = async (skill: LocalSkill, form: LocalSkillForm) => {
  const filePath = window.preload.path.join(skill.path, SKILL_FILE)
  let body = ''
  if (window.preload.fs.existsSync(filePath)) {
    body = parseSkillMd(await window.preload.fs.readTextFile(filePath)).body
  }
  await window.preload.fs.writeTextFile(filePath, buildSkillMd(form.name, form.description, body))
}

/**
 * 删除本地 Skill
 */
export const localSkillRemove = async (skill: LocalSkill) => {
  await window.preload.fs.rm(skill.path)
}

/**
 * 获取 SKILL.md 内容，不存在则返回默认模板
 */
export const localSkillContentGet = async (skill: LocalSkill): Promise<string> => {
  const filePath = window.preload.path.join(skill.path, SKILL_FILE)
  if (window.preload.fs.existsSync(filePath)) {
    return window.preload.fs.readTextFile(filePath)
  }
  return buildSkillMd(skill.name, skill.description, `# ${skill.name}\n`)
}

/**
 * 保存 SKILL.md 内容
 */
export const localSkillContentSet = async (skill: LocalSkill, content: string) => {
  await window.preload.fs.writeTextFile(window.preload.path.join(skill.path, SKILL_FILE), content)
}

/**
 * 递归列出 Skill 目录下全部文件
 */
export const localSkillFiles = async (skill: LocalSkill): Promise<Array<LocalSkillFile>> => {
  const result: Array<LocalSkillFile> = []
  const walk = async (dir: string, relative: string) => {
    if (!window.preload.fs.existsSync(dir)) return
    const items = await window.preload.fs.readDir(dir)
    for (const item of items) {
      const full = window.preload.path.join(dir, item.name)
      const rel = relative ? `${relative}/${item.name}` : item.name
      if (item.isDirectory) {
        await walk(full, rel)
      } else {
        result.push({
          name: item.name,
          path: full,
          relativePath: rel,
          size: item.size,
          mtime: item.mtime
        })
      }
    }
  }
  await walk(skill.path, '')
  return result.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}

/**
 * 读取任意文本文件
 */
export const localSkillFileRead = async (path: string): Promise<string> => {
  return window.preload.fs.readTextFile(path)
}
