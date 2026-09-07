/**
 * ESP32 LCD 配置（main 进程）：~/.mistrelle/buddy/esp32-lcd.json 的读写与归一化。
 * 仅屏幕自身配置（串口/事件转发）；额度插件是独立公共域（~/.mistrelle/buddy/quota.json，见 buddy/quota）。
 * 与红绿灯配置（traffic-light.json）相互独立；保存全量覆写，目录不存在时惰性创建。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { app } from 'electron'
import { LCD_BAUD_RATES, LCD_DEFAULT_BAUD_RATE, type Esp32LcdConfig } from '@common/types/esp32Lcd'

function configFilePath(): string {
  return join(app.getPath('home'), '.mistrelle', 'buddy', 'esp32-lcd.json')
}

/** 默认配置（文件缺失/损坏时回退，不回写磁盘） */
export function defaultEsp32LcdConfig(): Esp32LcdConfig {
  return { lastPort: '', baudRate: LCD_DEFAULT_BAUD_RATE, eventForward: true }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** 归一化波特率：只接受支持列表内的值 */
function normalizeBaudRate(value: unknown): number {
  return typeof value === 'number' && (LCD_BAUD_RATES as readonly number[]).includes(value)
    ? value
    : LCD_DEFAULT_BAUD_RATE
}

/** 归一化整份配置（磁盘文件与 IPC 入参共用） */
export function normalizeEsp32LcdConfig(raw: unknown): Esp32LcdConfig {
  const config = defaultEsp32LcdConfig()
  if (!isRecord(raw)) return config
  if (typeof raw.lastPort === 'string') config.lastPort = raw.lastPort
  config.baudRate = normalizeBaudRate(raw.baudRate)
  if (typeof raw.eventForward === 'boolean') config.eventForward = raw.eventForward
  if (typeof raw.screenQuota === 'string') config.screenQuota = raw.screenQuota
  return config
}

/** 启动加载：文件缺失/损坏回退默认配置 */
export function loadEsp32LcdConfig(): Esp32LcdConfig {
  const file = configFilePath()
  if (!existsSync(file)) return defaultEsp32LcdConfig()
  try {
    return normalizeEsp32LcdConfig(JSON.parse(readFileSync(file, 'utf-8')))
  } catch (error) {
    console.error('[esp32-lcd] 配置读取失败，使用默认配置', error)
    return defaultEsp32LcdConfig()
  }
}

/** 全量覆写落盘（目录惰性创建） */
export function saveEsp32LcdConfigFile(config: Esp32LcdConfig): void {
  const file = configFilePath()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(config, null, 2), 'utf-8')
}
