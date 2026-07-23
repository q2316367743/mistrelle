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

let _agentCache: Array<SkillAgent> | null = null

/**
 * 获取 agent 列表（含用户自定义）
 */
export const skillAgentList = (): Array<SkillAgent> => {
  if (_agentCache) return _agentCache
  const saved = KeyValueUtil.getItem<Array<SkillAgent>>(AGENT_STORAGE_KEY)
  if (saved && saved.length > 0) {
    _agentCache = saved
    return _agentCache
  }
  _agentCache = buildDefaultSkillAgents()
  return _agentCache
}

/**
 * 保存 agent 列表
 */
export const skillAgentSave = (agents: Array<SkillAgent>) => {
  _agentCache = null
  KeyValueUtil.setItem(AGENT_STORAGE_KEY, cloneDeep(agents))
}

export const skillAgentCacheClear = () => {
  _agentCache = null
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
 * 解析 YAML frontmatter：仅支持顶层 key 与块标量（| 字面量、> 折叠）
 * 兼容多行 description，避免逐行解析时把缩进内容丢失、只剩块标量指示符。
 */
const parseFrontmatter = (text: string): { data: Record<string, string>; body: string } => {
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/)
  if (!match) return { data: {}, body: text }
  const data: Record<string, string> = {}
  const lines = match[1].split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      i++
      continue
    }
    const idx = line.indexOf(':')
    if (idx < 0) {
      i++
      continue
    }
    const key = line.slice(0, idx).trim()
    const rawValue = line.slice(idx + 1).trim()
    const block = rawValue.match(/^([|>])([+-]?)$/)
    if (!block) {
      data[key] = unquoteYaml(rawValue)
      i++
      continue
    }
    // 块标量：收集后续缩进行，直到遇到非缩进行（即下一个顶层 key）
    const keepTrailing = block[2] !== '-'
    const collected: Array<string> = []
    i++
    let indent = -1
    while (i < lines.length) {
      const l = lines[i]
      if (l.trim() === '') {
        collected.push('')
        i++
        continue
      }
      const lead = l.match(/^(\s+)/)
      if (!lead) break // 列 0 起头的行不属于块标量
      if (indent < 0) indent = lead[1].length
      collected.push(l.slice(indent))
      i++
    }
    if (!keepTrailing) {
      while (collected.length && collected[collected.length - 1] === '') collected.pop()
    }
    data[key] = block[1] === '>' ? foldBlockScalar(collected) : collected.join('\n')
  }
  return { data, body: match[2] }
}

/**
 * 折叠标量（>）：连续非空行用空格连接，空行视为段落分隔
 */
const foldBlockScalar = (lines: Array<string>): string => {
  const out: Array<string> = []
  let para: Array<string> = []
  for (const line of lines) {
    if (line === '') {
      if (para.length) out.push(para.join(' '))
      para = []
    } else {
      para.push(line)
    }
  }
  if (para.length) out.push(para.join(' '))
  return out.join('\n')
}

/**
 * 去掉 YAML 标量两端的引号（若存在）
 */
const unquoteYaml = (value: string): string => {
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1)
    }
  }
  return value
}

/**
 * 解析 SKILL.md，拆出 frontmatter 与正文
 */
const parseSkillMd = (content: string): SkillMeta => {
  const { data, body } = parseFrontmatter(content)
  return {
    name: data.name ?? '',
    description: data.description ?? '',
    body
  }
}

/**
 * 生成 SKILL.md：description 含多行时以块标量 | 写入，避免破坏 YAML 结构
 */
const buildSkillMd = (name: string, description: string, body: string) => {
  const descLine = description.includes('\n')
    ? `description: |\n${description.replace(/\n+$/, '').split('\n').map((l) => `  ${l}`).join('\n')}\n`
    : `description: ${description}\n`
  return `---\nname: ${name}\n${descLine}---\n\n${body}`
}

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

export const skillList = ref<Array<LocalSkill>>()

/**
 * 清除本地 Skill 缓存
 */
export const localSkillCacheClear = () => {
  skillList.value = undefined
}

/**
 * 获取本地 Skill 列表，传入 agentKey 时只扫描指定 agent
 */
export const localSkillList = async (agentKey?: string, forceRefresh = false): Promise<Array<LocalSkill>> => {
  if (!forceRefresh && skillList.value) {
    return agentKey ? skillList.value.filter((e) => e.agentKey === agentKey) : skillList.value
  }
  const agents = skillAgentList().filter((e) => !agentKey || e.key === agentKey)
  const result = await Promise.all(agents.map((agent) => listAgentSkills(agent)))
  skillList.value = result.flat().sort((a, b) => b.updatedAt - a.updatedAt)
  if (agentKey) return skillList.value.filter((e) => e.agentKey === agentKey)
  return skillList.value
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
 * 读取 Skill 目录下的文本文件，禁止访问 agent.path 以外的路径
 */
export const localSkillFileRead = async (path: string): Promise<string> => {
  const resolved = window.preload.path.resolve(path)
  const allowed = skillAgentList().map((a) => window.preload.path.resolve(a.path))
  const isAllowed = allowed.some((base) => resolved.startsWith(base))
  if (!isAllowed) {
    throw new Error(`无权读取该文件：${path}`)
  }
  return window.preload.fs.readTextFile(path)
}
