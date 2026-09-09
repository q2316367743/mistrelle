/**
 * 小键盘配置（main 进程）：~/.mistrelle/buddy/keypad.json 的读写与归一化。
 * 结构：lastPort 记忆串口 + bindings（键位 id → 动作序列数组，动作按 type 判别）。
 * 动作归一化查 @common 动作注册表分发（新增动作零改动）；
 * 存量无 type 的旧格式（{modifiers, key}）回退 combo 兼容，无需迁移脚本。
 * 配置由 main 持有，保存全量覆写；目录不存在时惰性创建；缺失/损坏回退默认不回写。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { app } from 'electron'
import { keypadActionDefinition } from '@common/keypad/actions'
import { comboAction } from '@common/keypad/actions/combo'
import { isKeypadLayoutId, type KeypadAction, type KeypadBinding, type KeypadConfig } from '@common/types/keypad'

function configFilePath(): string {
  return join(app.getPath('home'), '.mistrelle', 'buddy', 'keypad.json')
}

/** 默认配置（文件缺失/损坏时回退，不回写磁盘） */
export function defaultConfig(): KeypadConfig {
  return { lastPort: '', bindings: {}, layout: 'grid4x2' }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** 归一化单条动作：查动作注册表分发清洗；无 type 的存量 combo 旧格式兼容；非法返回 null 丢弃 */
export function normalizeAction(raw: unknown): KeypadAction | null {
  if (!isRecord(raw)) return null
  if (typeof raw.type === 'string') {
    const definition = keypadActionDefinition(raw.type)
    return definition ? definition.normalize(raw) : null
  }
  return comboAction.normalize(raw)
}

/** 归一化动作序列：数组逐条清洗；单动作对象（存量各代格式）包装单元素；空/全非法返回 null */
function normalizeActions(raw: unknown): KeypadAction[] | null {
  if (Array.isArray(raw)) {
    const actions = raw.map(normalizeAction).filter((action): action is KeypadAction => action != null)
    return actions.length ? actions : null
  }
  const action = normalizeAction(raw)
  return action ? [action] : null
}

/**
 * 归一化单个键位的绑定：新格式 {name?, actions}（name trim 非空才保留）；
 * 纯数组 = 上一代无名序列；对象 = 更早的单动作（含最老 combo 格式）。非法返回 null 丢弃。
 */
export function normalizeBinding(raw: unknown): KeypadBinding | null {
  if (isRecord(raw) && Array.isArray(raw.actions)) {
    const actions = normalizeActions(raw.actions)
    if (!actions) return null
    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    return name ? { name, actions } : { actions }
  }
  const actions = normalizeActions(raw)
  return actions ? { actions } : null
}

/** 归一化整份配置：键位绑定逐个清洗 + 布局白名单校验（磁盘文件与 IPC 入参共用） */
export function normalizeConfig(raw: unknown): KeypadConfig {
  const config = defaultConfig()
  if (!isRecord(raw)) return config
  if (typeof raw.lastPort === 'string') config.lastPort = raw.lastPort
  if (typeof raw.layout === 'string' && isKeypadLayoutId(raw.layout)) {
    config.layout = raw.layout
  }
  if (!isRecord(raw.bindings)) return config
  const bindings: Record<string, KeypadBinding> = {}
  for (const [keyId, rawBinding] of Object.entries(raw.bindings)) {
    const binding = normalizeBinding(rawBinding)
    if (binding) bindings[keyId] = binding
  }
  config.bindings = bindings
  return config
}

/** 启动加载：文件缺失/损坏回退默认配置 */
export function loadConfig(): KeypadConfig {
  const file = configFilePath()
  if (!existsSync(file)) return defaultConfig()
  try {
    return normalizeConfig(JSON.parse(readFileSync(file, 'utf-8')))
  } catch (error) {
    console.error('[keypad] 配置读取失败，使用默认配置', error)
    return defaultConfig()
  }
}

/** 全量覆写落盘（目录惰性创建） */
export function saveConfigFile(config: KeypadConfig): void {
  const file = configFilePath()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(config, null, 2), 'utf-8')
}
