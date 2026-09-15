/**
 * 小键盘配置（main 进程）：~/.mistrelle/buddy/keypad.json 的读写与归一化。
 * 结构：lastPort 记忆串口 + bindings（控件 id → 各信号绑定）+ layout 键盘样式。
 * 动作归一化查 @common 动作注册表分发（新增动作零改动）；
 * 绑定归一化按「信号嵌套」清洗，**旧扁平格式**（`bindings["1"] = {actions}` / 纯数组 /
 * 单动作对象，含最老的无 type combo 格式）自动迁移为 `{ on: 绑定 }`，无需迁移脚本。
 * 配置由 main 持有，保存全量覆写；目录不存在时惰性创建；缺失/损坏回退默认不回写。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { app } from 'electron'
import { keypadActionDefinition } from '@common/keypad/actions'
import { comboAction } from '@common/keypad/actions/combo'
import {
  isKeypadBindSignal,
  isKeypadLayoutId,
  KEYPAD_BIND_SIGNALS,
  KEYPAD_REPEAT_MS_MAX,
  KEYPAD_REPEAT_MS_MIN,
  keypadSignalSupportsHold,
  type KeypadAction,
  type KeypadBinding,
  type KeypadBindingMap,
  type KeypadConfig
} from '@common/types/keypad'

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
    const actions = raw
      .map(normalizeAction)
      .filter((action): action is KeypadAction => action != null)
    return actions.length ? actions : null
  }
  const action = normalizeAction(raw)
  return action ? [action] : null
}

/**
 * 归一化单路绑定：`{name?, actions, holdActions?, holdRepeatMs?}`
 * （name trim 非空才保留；holdActions 长按序列可选，空/全非法不落盘；
 * holdRepeatMs 取整夹区间，仅在配置了长按序列时保留）；
 * 纯数组 = 上一代无名序列；对象 = 更早的单动作（含最老 combo 格式）。非法返回 null 丢弃。
 *
 * `allowHold`：该信号是否支持长按（`keypadSignalSupportsHold`）——转动信号传入 false 时
 * **剥除** holdActions/holdRepeatMs（转动是瞬时事件，没有长按语义），存量脏数据由此清掉。
 */
export function normalizeBinding(raw: unknown, allowHold = true): KeypadBinding | null {
  if (isRecord(raw) && Array.isArray(raw.actions)) {
    const actions = normalizeActions(raw.actions)
    if (!actions) return null
    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    const binding: KeypadBinding = name ? { name, actions } : { actions }
    if (!allowHold) return binding
    const holdActions = Array.isArray(raw.holdActions) ? normalizeActions(raw.holdActions) : null
    if (holdActions) {
      binding.holdActions = holdActions
      const ms = typeof raw.holdRepeatMs === 'number' ? Math.round(raw.holdRepeatMs) : NaN
      if (Number.isFinite(ms)) {
        binding.holdRepeatMs = Math.min(Math.max(ms, KEYPAD_REPEAT_MS_MIN), KEYPAD_REPEAT_MS_MAX)
      }
    }
    return binding
  }
  const actions = normalizeActions(raw)
  return actions ? { actions } : null
}

/** 该记录是否已是「信号嵌套」新格式（含任一可绑定信号键即视为新格式） */
function isBindingMapShape(raw: Record<string, unknown>): boolean {
  return Object.keys(raw).some((key) => isKeypadBindSignal(key))
}

/**
 * 归一化单个控件的绑定表：
 * - 新格式（含 `on`/`left`/`right` 任一键）→ 逐信号清洗（off 与未知键丢弃；
 *   转动信号剥除长按字段），全空返回 null
 * - 旧扁平格式（`{name?,actions,...}` / 纯数组 / 单动作对象）→ 迁移为 `{ on: 绑定 }`
 */
export function normalizeBindingMap(raw: unknown): KeypadBindingMap | null {
  if (!isRecord(raw)) return null
  if (!isBindingMapShape(raw)) {
    const binding = normalizeBinding(raw)
    return binding ? { on: binding } : null
  }
  const map: KeypadBindingMap = {}
  for (const signal of KEYPAD_BIND_SIGNALS) {
    const binding = normalizeBinding(raw[signal], keypadSignalSupportsHold(signal))
    if (binding) map[signal] = binding
  }
  return Object.keys(map).length ? map : null
}

/** 归一化整份配置的绑定表：逐控件清洗，空表控件丢弃（磁盘文件与 IPC 入参共用） */
export function normalizeBindings(raw: unknown): Record<string, KeypadBindingMap> {
  const bindings: Record<string, KeypadBindingMap> = {}
  if (!isRecord(raw)) return bindings
  for (const [controlId, rawMap] of Object.entries(raw)) {
    const map = normalizeBindingMap(rawMap)
    if (map) bindings[controlId] = map
  }
  return bindings
}

/** 归一化整份配置：控件绑定逐个清洗 + 布局白名单校验（磁盘文件与 IPC 入参共用） */
export function normalizeConfig(raw: unknown): KeypadConfig {
  const config = defaultConfig()
  if (!isRecord(raw)) return config
  if (typeof raw.lastPort === 'string') config.lastPort = raw.lastPort
  if (typeof raw.layout === 'string' && isKeypadLayoutId(raw.layout)) {
    config.layout = raw.layout
  }
  config.bindings = normalizeBindings(raw.bindings)
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
