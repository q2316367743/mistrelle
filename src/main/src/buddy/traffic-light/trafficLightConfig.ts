/**
 * 红绿灯配置（main 进程）：~/.mistrelle/buddy/traffic-light.json 的读写、归一化与校验。
 * 配置由 main 持有（事件映射不依赖渲染层），保存全量覆写；目录不存在时惰性创建。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { app } from 'electron'
import {
  LIGHT_STATE_CODES,
  OPENCODE_EVENT_NAMES,
  SOFTWARE_NAMES,
  type LightState,
  type OpencodeEventName,
  type SoftwareLightConfig,
  type SoftwareName,
  type TrafficLightConfig
} from '@common/buddy/traffic-light/trafficLightChannels'

/** 首次使用时的默认绑定（语义见 docs/hardware/03；tool.execute.after 默认不绑） */
const DEFAULT_OPENCODE_BINDINGS: Partial<Record<OpencodeEventName, LightState>> = {
  'message.part.updated': 'gs',
  'tool.execute.before': 'yo',
  'session.idle': 'go',
  'permission.asked': 'ys',
  'session.error': 'rs'
}

function configFilePath(): string {
  return join(app.getPath('home'), '.mistrelle', 'buddy', 'traffic-light.json')
}

/** 默认配置（文件缺失/损坏时回退，不回写磁盘） */
export function defaultConfig(): TrafficLightConfig {
  return {
    lastPort: '',
    config: { opencode: { enabled: true, bindings: { ...DEFAULT_OPENCODE_BINDINGS } } }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isLightState(value: string): value is LightState {
  return (LIGHT_STATE_CODES as readonly string[]).includes(value)
}

function isSoftwareName(value: string): value is SoftwareName {
  return (SOFTWARE_NAMES as readonly string[]).includes(value)
}

/** 归一化单个软件配置：未知事件/灯态剔除，enabled 仅认 true */
export function normalizeSoftware(raw: unknown): SoftwareLightConfig {
  if (!isRecord(raw)) return { enabled: false, bindings: {} }
  const bindings: Partial<Record<OpencodeEventName, LightState>> = {}
  const rawBindings = raw.bindings
  if (isRecord(rawBindings)) {
    for (const event of OPENCODE_EVENT_NAMES) {
      const state = rawBindings[event]
      if (typeof state === 'string' && isLightState(state)) bindings[event] = state
    }
  }
  return { enabled: raw.enabled === true, bindings }
}

/** 归一化整份配置：未知软件剔除、字段兜底（磁盘文件与 IPC 入参共用） */
export function normalizeConfig(raw: unknown): TrafficLightConfig {
  const config = defaultConfig()
  if (!isRecord(raw)) return config
  if (typeof raw.lastPort === 'string') config.lastPort = raw.lastPort
  if (!isRecord(raw.config)) return config
  const softwares: Partial<Record<SoftwareName, SoftwareLightConfig>> = {}
  for (const name of SOFTWARE_NAMES) {
    const item = raw.config[name]
    if (isRecord(item)) softwares[name] = normalizeSoftware(item)
  }
  config.config = softwares
  return config
}

/** 启动加载：文件缺失/损坏回退默认配置 */
export function loadConfig(): TrafficLightConfig {
  const file = configFilePath()
  if (!existsSync(file)) return defaultConfig()
  try {
    return normalizeConfig(JSON.parse(readFileSync(file, 'utf-8')))
  } catch (error) {
    console.error('[traffic-light] 配置读取失败，使用默认配置', error)
    return defaultConfig()
  }
}

/** 全量覆写落盘（目录惰性创建） */
export function saveConfigFile(config: TrafficLightConfig): void {
  const file = configFilePath()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(config, null, 2), 'utf-8')
}

/** 校验灯态绑定唯一（同一软件内一个灯态只允许被一个事件绑定） */
export function validateBindingUniqueness(bindings: SoftwareLightConfig['bindings']): string | null {
  const owner = new Map<LightState, string>()
  for (const [event, state] of Object.entries(bindings)) {
    if (!state) continue
    const prev = owner.get(state)
    if (prev) return `灯态 ${state} 已被事件 ${prev} 绑定，一种灯态只能绑定一个事件`
    owner.set(state, event)
  }
  return null
}

/**
 * 软件互斥归一：保留 keep 的启用状态，其余软件强制 disabled（返回新对象）。
 * keep 用 string 比较，避免与 SoftwareName 字面量互斥比较时把键收窄成 never。
 */
export function applySoftwareExclusion(
  softwares: Partial<Record<SoftwareName, SoftwareLightConfig>>,
  keep: string
): Partial<Record<SoftwareName, SoftwareLightConfig>> {
  const next: Partial<Record<SoftwareName, SoftwareLightConfig>> = {}
  for (const name of SOFTWARE_NAMES) {
    const item = softwares[name]
    if (!item) continue
    next[name] = name === keep ? item : { ...item, enabled: false }
  }
  return next
}

export { isSoftwareName }
