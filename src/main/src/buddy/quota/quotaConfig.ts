/**
 * 额度配置（main 进程）：~/.mistrelle/buddy/quota.json 的读写与归一化。
 * 额度是独立公共域（不依附任何设备配置）；保存全量覆写，目录不存在时惰性创建。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { app } from 'electron'
import {
  type BuiltinQuotaPluginConfig,
  type BuiltinQuotaPluginId,
  type ExternalQuotaPluginConfig,
  type QuotaConfig,
  type QuotaItem,
  type QuotaSnapshot
} from '@common/types/quota'
import { isSafePluginFile } from './externalPlugins'

function configFilePath(): string {
  return join(app.getPath('home'), '.mistrelle', 'buddy', 'quota.json')
}

/** 默认配置（文件缺失/损坏时回退，不回写磁盘） */
export function defaultQuotaConfig(): QuotaConfig {
  return {
    intervalMinutes: 5,
    builtin: { deepseek: { enabled: true, settings: { apiKey: '' } } },
    external: {}
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * 归一化插件配置（内置/第三方同构）：settings 键值只留字符串；
 * 兼容旧结构顶层 apiKey（曾嵌在 esp32-lcd.json 的 quota 段）搬入 settings。
 */
function normalizePluginConfig(raw: unknown): BuiltinQuotaPluginConfig {
  if (!isRecord(raw)) return { enabled: false, settings: {} }
  const settings: Record<string, string> = {}
  if (typeof raw.apiKey === 'string') settings.apiKey = raw.apiKey
  if (isRecord(raw.settings)) {
    for (const [key, value] of Object.entries(raw.settings)) {
      if (typeof value === 'string') settings[key] = value
    }
  }
  return { enabled: raw.enabled === true, settings }
}

/**
 * 归一化持久化快照（启动恢复用，防御手改文件）：at 非法整体丢弃；
 * items 逐条过滤（label/value 必为字符串），可选字段按类型校验保留。
 */
function normalizeQuotaSnapshot(raw: unknown): QuotaSnapshot | null {
  if (!isRecord(raw)) return null
  if (typeof raw.at !== 'number' || !Number.isFinite(raw.at)) return null
  const items: QuotaItem[] = []
  if (Array.isArray(raw.items)) {
    for (const item of raw.items) {
      if (!isRecord(item)) continue
      if (typeof item.label !== 'string' || typeof item.value !== 'string') continue
      const normalized: QuotaItem = { label: item.label, value: item.value }
      if (typeof item.pluginKey === 'string') normalized.pluginKey = item.pluginKey
      if (item.screenTemplate === 'codex' || item.screenTemplate === 'deepseek') {
        normalized.screenTemplate = item.screenTemplate
      }
      if (typeof item.screenPct === 'number' && Number.isFinite(item.screenPct)) {
        normalized.screenPct = item.screenPct
      }
      if (typeof item.screenValue === 'string') normalized.screenValue = item.screenValue
      if (typeof item.screenUnit === 'string') normalized.screenUnit = item.screenUnit
      items.push(normalized)
    }
  }
  const snapshot: QuotaSnapshot = { items, at: raw.at }
  if (typeof raw.error === 'string' && raw.error) snapshot.error = raw.error
  return snapshot
}

/** 归一化整份配置：间隔钳制 1-1440 分钟，builtin 未知插件剔除、external 键按安全文件名过滤 */
export function normalizeQuotaConfig(raw: unknown): QuotaConfig {
  const config = defaultQuotaConfig()
  if (!isRecord(raw)) return config
  if (typeof raw.intervalMinutes === 'number' && Number.isFinite(raw.intervalMinutes)) {
    config.intervalMinutes = Math.min(1440, Math.max(1, Math.round(raw.intervalMinutes)))
  }
  if (isRecord(raw.builtin)) {
    const builtin: Partial<Record<BuiltinQuotaPluginId, BuiltinQuotaPluginConfig>> = {}
    const deepseek = raw.builtin.deepseek
    if (isRecord(deepseek)) builtin.deepseek = normalizePluginConfig(deepseek)
    config.builtin = builtin
  }
  if (isRecord(raw.external)) {
    const external: Record<string, ExternalQuotaPluginConfig> = {}
    for (const [file, item] of Object.entries(raw.external)) {
      if (isSafePluginFile(file)) external[file] = normalizePluginConfig(item)
    }
    config.external = external
  }
  config.lastSnapshot = normalizeQuotaSnapshot(raw.lastSnapshot)
  return config
}

/** 启动加载：文件缺失/损坏回退默认配置 */
export function loadQuotaConfig(): QuotaConfig {
  const file = configFilePath()
  if (!existsSync(file)) return defaultQuotaConfig()
  try {
    return normalizeQuotaConfig(JSON.parse(readFileSync(file, 'utf-8')))
  } catch (error) {
    console.error('[quota] 配置读取失败，使用默认配置', error)
    return defaultQuotaConfig()
  }
}

/** 全量覆写落盘（目录惰性创建） */
export function saveQuotaConfigFile(config: QuotaConfig): void {
  const file = configFilePath()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(config, null, 2), 'utf-8')
}
