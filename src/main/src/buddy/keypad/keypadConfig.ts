/**
 * 小键盘配置（main 进程）：~/.mistrelle/buddy/keypad.json 的读写与归一化。
 * 结构：lastPort 记忆串口 + bindings（键位 id → 动作，按 type 判别）。
 * 动作归一化查 @common 动作注册表分发（新增动作零改动）；
 * 存量无 type 的旧格式（{modifiers, key}）回退 combo 兼容，无需迁移脚本。
 * 配置由 main 持有，保存全量覆写；目录不存在时惰性创建；缺失/损坏回退默认不回写。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { app } from 'electron'
import { keypadActionDefinition } from '@common/keypad/actions'
import { comboAction } from '@common/keypad/actions/combo'
import type { KeypadAction, KeypadConfig } from '@common/types/keypad'

function configFilePath(): string {
  return join(app.getPath('home'), '.mistrelle', 'buddy', 'keypad.json')
}

/** 默认配置（文件缺失/损坏时回退，不回写磁盘） */
export function defaultConfig(): KeypadConfig {
  return { lastPort: '', bindings: {} }
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

/** 归一化整份配置：键位动作逐条白名单清洗（磁盘文件与 IPC 入参共用） */
export function normalizeConfig(raw: unknown): KeypadConfig {
  const config = defaultConfig()
  if (!isRecord(raw)) return config
  if (typeof raw.lastPort === 'string') config.lastPort = raw.lastPort
  if (!isRecord(raw.bindings)) return config
  const bindings: Record<string, KeypadAction> = {}
  for (const [keyId, rawBinding] of Object.entries(raw.bindings)) {
    const action = normalizeAction(rawBinding)
    if (action) bindings[keyId] = action
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
