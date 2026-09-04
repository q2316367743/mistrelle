/**
 * TypeBox 工具（canvas 模块）：
 * - toToolProperty：TypeBox schema → 喂给模型的 ToolProperty 参数描述（单一数据源）
 * - collectErrors：Value.Errors → 中文错误信息数组（运行时校验，非法即报错反馈模型自纠）
 */
import { Value } from '@sinclair/typebox/value'
import type { TSchema } from '@sinclair/typebox'
import type { ToolProperty } from '@/domain'

interface JsonSchemaNode {
  type?: string
  const?: unknown
  enum?: unknown[]
  anyOf?: JsonSchemaNode[]
  properties?: Record<string, JsonSchemaNode>
  items?: JsonSchemaNode
  required?: string[]
  additionalProperties?: boolean
  description?: string
  $ref?: string
}

/** TypeBox schema → ToolProperty（递归转换；$ref 递归引用降级为宽松 object） */
export const toToolProperty = (schema: TSchema): ToolProperty =>
  toToolPropertyInner(schema as unknown as JsonSchemaNode)

/** 非全 const 的 anyOf：推断顶层 type（禁止一律标成 string，否则模型会把对象/数组 JSON.stringify） */
const inferAnyOfType = (branches: JsonSchemaNode[]): string => {
  const types = [
    ...new Set(
      branches
        .map((b) => {
          if (b.type) return b.type
          if (b.const !== undefined) return typeof b.const === 'number' ? 'number' : 'string'
          if (b.properties || b.additionalProperties !== undefined) return 'object'
          if (b.items) return 'array'
          return undefined
        })
        .filter((t): t is string => !!t)
    )
  ]
  if (types.length === 1) return types[0]!
  // 对象联合（batch op / SlideNode）→ object；含 array 的混联优先 array；其余才是 string
  if (types.every((t) => t === 'object')) return 'object'
  if (types.includes('object')) return 'object'
  if (types.includes('array')) return 'array'
  return types[0] ?? 'string'
}

const toToolPropertyInner = (schema: JsonSchemaNode): ToolProperty => {
  if (schema.$ref) {
    return { type: 'object', description: '递归子节点' }
  }
  const description = schema.description ?? ''
  if (schema.anyOf) {
    const consts = schema.anyOf.filter(
      (x) => x.const !== undefined && (x.type ?? 'string') === 'string'
    )
    if (consts.length === schema.anyOf.length && consts.length > 0) {
      return { type: 'string', description, enum: consts.map((x) => x.const) }
    }
    return {
      type: inferAnyOfType(schema.anyOf),
      description,
      anyOf: schema.anyOf.map(toToolPropertyInner)
    }
  }
  if (schema.const !== undefined) {
    return {
      type: typeof schema.const === 'number' ? 'number' : 'string',
      description,
      const: schema.const
    }
  }
  if (schema.enum) return { type: 'string', description, enum: schema.enum }
  switch (schema.type) {
    case 'object': {
      const out: ToolProperty = { type: 'object', description }
      if (schema.properties) {
        out.properties = Object.fromEntries(
          Object.entries(schema.properties).map(([k, v]) => [k, toToolPropertyInner(v)])
        )
      }
      if (schema.required?.length) out.required = [...schema.required]
      if (schema.additionalProperties === false) out.additionalProperties = false
      return out
    }
    case 'array':
      return {
        type: 'array',
        description,
        ...(schema.items ? { items: toToolPropertyInner(schema.items) } : {})
      }
    case 'number':
    case 'boolean':
    case 'string':
      return { type: schema.type, description }
    default:
      return { type: 'string', description }
  }
}

export interface ValueErrorLike {
  path: string
  message: string
  schema?: JsonSchemaNode
}

const TYPE_LABELS: Record<string, string> = {
  number: '数字',
  string: '字符串',
  boolean: '布尔值',
  array: '数组',
  object: '对象'
}

/** 从 anyOf 对象分支的 properties 中收集 const 判别值（如 tag / op） */
const collectConstDiscriminators = (anyOf: JsonSchemaNode[]): string[] => {
  const labels: string[] = []
  for (const branch of anyOf) {
    if (branch.type !== 'object' || !branch.properties) continue
    for (const prop of Object.values(branch.properties)) {
      if (prop.const !== undefined) {
        labels.push(`"${String(prop.const)}"`)
        break
      }
    }
  }
  return labels
}

const errToMessage = (e: ValueErrorLike): string => {
  const field = e.path === '' ? '' : `字段 ${e.path.replace(/\//g, '.').replace(/^\./, '')}`
  switch (e.message) {
    case 'Expected required property':
      return `${field} 缺少必填`
    case 'Unexpected property':
      return `${field} 未定义的字段`
    case 'Expected union value': {
      const anyOf = e.schema?.anyOf ?? []
      const discriminators = collectConstDiscriminators(anyOf)
      if (discriminators.length > 0) {
        return `${field} 取值不合法（允许：${[...new Set(discriminators)].join(' / ')}）`
      }
      const parts = anyOf.map((x) =>
        x.const !== undefined
          ? `"${String(x.const)}"`
          : (TYPE_LABELS[x.type ?? ''] ?? x.type ?? '值')
      )
      return `${field} 取值不合法（允许：${[...new Set(parts)].join(' / ')}）`
    }
    case 'Expected number':
      return `${field} 应为数字`
    case 'Expected string':
      return `${field} 应为字符串`
    case 'Expected boolean':
      return `${field} 应为布尔值`
    case 'Expected array':
      return `${field} 应为数组`
    case 'Expected object':
      return `${field} 应为对象`
    default:
      if (e.message.includes('less or equal')) return `${field} 超过上限`
      if (e.message.includes('greater or equal')) return `${field} 低于下限`
      if (e.message.includes('Expected array length')) return `${field} 长度不符合要求`
      return `${field} ${e.message}`
  }
}

export interface CollectErrorsOptions {
  /** 中文化前忽略部分原始错误（用于 Recursive Union 改由调用方按 tag 递归展开） */
  ignore?: (e: ValueErrorLike) => boolean
}

/** 把子错误挂到父字段下：`字段 attr.x …` → `字段 node.attr.x …` */
export const nestFieldError = (prefix: string, message: string): string => {
  if (message.startsWith('字段 ')) return `字段 ${prefix}.${message.slice('字段 '.length)}`
  return `字段 ${prefix}：${message}`
}

/** 校验值并返回中文错误信息数组（合法返回空数组） */
export const collectErrors = (
  schema: TSchema,
  value: unknown,
  options?: CollectErrorsOptions
): string[] => {
  const errs = [...Value.Errors(schema, value)] as unknown as ValueErrorLike[]
  const requiredPaths = new Set(
    errs.filter((e) => e.message === 'Expected required property').map((e) => e.path)
  )
  return errs
    .filter((e) => !(requiredPaths.has(e.path) && e.message !== 'Expected required property'))
    .filter((e) => !options?.ignore?.(e))
    .map(errToMessage)
}
