import type { AiUsage } from '../types'

/** 归一 baseURL：去尾部斜杠；anthropic 若以 /v1 结尾则去掉，避免拼出 /v1/v1/messages */
export const normalizeBase = (baseURL: string): string => baseURL.trim().replace(/\/+$/, '')

/** 把各种厂商的 usage 结构归一为 AiUsage；无法识别返回 undefined */
export const toUsage = (value: unknown): AiUsage | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const input =
    typeof record['prompt_tokens'] === 'number'
      ? (record['prompt_tokens'] as number)
      : typeof record['input_tokens'] === 'number'
        ? (record['input_tokens'] as number)
        : undefined
  const output =
    typeof record['completion_tokens'] === 'number'
      ? (record['completion_tokens'] as number)
      : typeof record['output_tokens'] === 'number'
        ? (record['output_tokens'] as number)
        : undefined
  if (input === undefined && output === undefined) return undefined
  return {
    prompt_tokens: input ?? 0,
    completion_tokens: output ?? 0,
    total_tokens:
      typeof record['total_tokens'] === 'number'
        ? (record['total_tokens'] as number)
        : (input ?? 0) + (output ?? 0)
  }
}

/** 安全解析 JSON 字符串；解析失败返回 fallback */
export const safeJsonParse = (text: string, fallback: unknown): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return fallback
  }
}

/** 记录守卫：非 null 对象且非数组 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** 提取字符串字段 */
export const strField = (record: Record<string, unknown>, key: string): string | undefined =>
  typeof record[key] === 'string' ? (record[key] as string) : undefined

/**
 * 服务端错误对象（SSE 错误帧内的 error 字段）转可抛出的可见错误。
 * - message 超长截断（错误帧常内嵌完整请求参数回显，全文进 UI 提示不可读）；
 * - code 为数字或数字串时附带 status（HttpError 形状），供重试策略按 429/5xx 分类。
 */
export const toStreamError = (error: unknown): Error => {
  if (!isRecord(error)) return new Error(String(error))
  const raw = strField(error, 'message') ?? strField(error, 'type') ?? '服务端返回错误'
  const message = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw
  const code = error['code']
  const status =
    typeof code === 'number'
      ? code
      : typeof code === 'string' && /^\d+$/.test(code)
        ? Number(code)
        : undefined
  return status === undefined ? new Error(message) : Object.assign(new Error(message), { status })
}
