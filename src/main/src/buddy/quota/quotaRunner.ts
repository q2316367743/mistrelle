/**
 * 额度插件脚本执行器（main 进程）：参考 CodexBar 的 provider 设计做的极简版。
 * 插件 = 单段 JS 源码，必须恰好调用一次 definePlugin(manifest)，宿主调用 manifest.fetch(ctx)
 * 拿到额度快照；脚本在主进程 Node 环境执行（本地自写脚本，无沙箱隔离，文档已注明）。
 * ctx.fetch 是全局 fetch 的极简封装（统一超时、只回 status + body 文本），ctx.settings 为插件配置键值。
 * collectQuotaPlugin 与 runQuotaScript 两段拆开：collect 只编译收集元数据（id/name/settings 声明），
 * 供插件列表展示（内置与目录第三方统一模型）；runQuotaScript 负责真正执行。
 */
import type { PluginSettingField, QuotaItem } from '@common/types/quota'
import { appAxios } from '../../modules/network/appAxios'

/** 单次网络请求超时 */
const FETCH_TIMEOUT_MS = 15_000
/** 快照条目上限（防脚本返回超量数据） */
const MAX_ITEMS = 8

/** 插件 manifest（脚本经 definePlugin 上交） */
export interface QuotaPluginManifest {
  id: string
  name: string
  /** 插件声明的设置项（UI 通用 settings 表单渲染依据） */
  settings?: PluginSettingField[]
  fetch: (ctx: QuotaPluginContext) => Promise<{ items?: QuotaItem[] }>
}

/** 插件运行上下文 */
export interface QuotaPluginContext {
  /** 插件 settings 键值（来自对应插件的持久化配置） */
  settings: Record<string, string>
  /** 极简 HTTP：统一超时，只回 status 与 body 文本 */
  fetch: (
    url: string,
    init?: { headers?: Record<string, string> }
  ) => Promise<{ status: number; body: string }>
}

/** 执行结果 */
export interface QuotaPluginResult {
  name: string
  items: QuotaItem[]
}

/**
 * 编译并收集插件 manifest（不执行 fetch）。内置与目录第三方共用：
 * 列表展示（id/name/settings）与执行都以此为唯一入口。
 * 失败抛错（中文原因），由调用方容错。
 */
export function collectQuotaPlugin(code: string): QuotaPluginManifest {
  // 闭包写入用 holder 承载（直接对 let 赋值会被 TS 收窄成 never）
  const holder: { manifest: QuotaPluginManifest | null } = { manifest: null }
  const definePlugin = (input: QuotaPluginManifest): void => {
    if (holder.manifest) throw new Error('definePlugin 只能调用一次')
    if (!input || typeof input.fetch !== 'function') throw new Error('definePlugin 缺少 fetch 函数')
    holder.manifest = input
  }
  try {
    new Function('definePlugin', `"use strict";\n${code}`)(definePlugin)
  } catch (e) {
    throw new Error('脚本编译失败：' + (e as Error).message)
  }
  const manifest = holder.manifest
  if (!manifest) throw new Error('脚本未调用 definePlugin')
  return manifest
}

/** 合法屏显数值：仅数字与小数点，≤15 字符（协议约束，非法则整字段忽略） */
const SCREEN_VALUE_PATTERN = /^[0-9.]{1,15}$/

/** 归一单条屏显字段：枚举/范围/字符集逐项校验，非法字段忽略（条目保留用于 UI 展示） */
function normalizeScreenFields(item: QuotaItem): QuotaItem {
  const next: QuotaItem = { label: item.label, value: item.value }
  if (item.screenTemplate === 'codex' || item.screenTemplate === 'deepseek') {
    next.screenTemplate = item.screenTemplate
  }
  if (typeof item.screenPct === 'number' && Number.isFinite(item.screenPct)) {
    next.screenPct = Math.min(100, Math.max(0, Math.round(item.screenPct)))
  }
  if (typeof item.screenValue === 'string' && SCREEN_VALUE_PATTERN.test(item.screenValue)) {
    next.screenValue = item.screenValue
  }
  if (typeof item.screenUnit === 'string') next.screenUnit = item.screenUnit
  return next
}

/** 快照条目归一：只保留 label/value 均为字符串的条目，屏显字段逐项校验，超量截断 */
function normalizeItems(raw: unknown): QuotaItem[] {
  if (!Array.isArray(raw)) return []
  const items: QuotaItem[] = []
  for (const item of raw) {
    if (
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).label === 'string' &&
      typeof (item as Record<string, unknown>).value === 'string'
    ) {
      items.push(normalizeScreenFields(item as QuotaItem))
    }
    if (items.length >= MAX_ITEMS) break
  }
  return items
}

/**
 * 执行一段插件脚本：collect → 构造 ctx → 调 fetch 拿快照。
 * 任何环节失败抛错（中文原因），由调用方汇聚。
 */
export async function runQuotaScript(
  code: string,
  settings: Record<string, string>
): Promise<QuotaPluginResult> {
  const manifest = collectQuotaPlugin(code)
  const ctx: QuotaPluginContext = {
    settings,
    fetch: async (url, init) => {
      // 统一走 appAxios（代理 / UA / TLS 策略随网络设置）；契约保持 { status, body: text }
      const res = await appAxios.get<string>(url, {
        headers: init?.headers,
        responseType: 'text',
        timeout: FETCH_TIMEOUT_MS,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      })
      return { status: res.status, body: res.data }
    }
  }
  const snapshot = await manifest.fetch(ctx)
  return { name: manifest.name || manifest.id, items: normalizeItems(snapshot?.items) }
}
