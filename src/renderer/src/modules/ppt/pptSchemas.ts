/**
 * PPT 元素 schema 校验与模型侧参数描述（TypeBox 单一源）。
 * 节点结构定义见 pptElementSchemas.ts，本文件只做转换与运行时校验：
 * - pptElementSchema / pptElementsSchema：喂给模型的 ToolProperty 参数描述
 * - validatePptElement / validatePptElements / validatePptTheme：入参拦截（中文报错反馈模型自纠）
 */
import {
  collectErrors,
  nestFieldError,
  toToolProperty,
  type ValueErrorLike
} from '@/modules/tool/typeboxUtil'
import type { ToolProperty } from '@/domain'
import { pptElementSchemaT, pptElementVariants, pptElementsSchemaT } from './pptElementSchemas'
import { normalizePptNodeTree } from './pptAttrNormalize'
import { Type } from '@sinclair/typebox'
import type { TSchema } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

/** 元素 schema（供模型了解 batch_edit 的 elements 元素结构） */
export const pptElementSchema: ToolProperty = toToolProperty(pptElementSchemaT)

/** 元素数组 schema（供模型了解 add_slide / batch_edit 的 elements 参数） */
export const pptElementsSchema: ToolProperty = toToolProperty(pptElementsSchemaT)

/** update / copy.overrides 的 patch 参数 schema：attr 合并 / text 覆盖 / child 替换（任意组合） */
export const pptElementPatchSchemaT = Type.Object(
  {
    attr: Type.Optional(
      Type.Record(Type.String(), Type.Union([Type.String(), Type.Number(), Type.Boolean()]), {
        description: '要合并或覆盖的属性（点表示法键，如 fontSize、border.color；缺省不改 attr'
      })
    ),
    text: Type.Optional(Type.String({ description: '文本内容（仅文本节点，覆盖 child 字符串）' })),
    child: Type.Optional(
      Type.Array(pptElementSchemaT, { description: '替换子元素数组（SlideNode JSON）' })
    )
  },
  {
    additionalProperties: false,
    description: '节点编辑补丁：attr 合并 / text 覆盖 / child 替换（任意组合）'
  }
)

/** patch 参数描述（喂给模型） */
export const pptElementPatchSchema: ToolProperty = toToolProperty(pptElementPatchSchemaT)

/** 可用元素类型清单（错误提示用） */
const PPT_ELEMENT_TYPES = Object.keys(pptElementVariants)

const isPptElementTag = (tag: unknown): tag is string =>
  typeof tag === 'string' && tag in pptElementVariants

const typeboxPathToField = (path: string): string =>
  path.replace(/\//g, '.').replace(/^\./, '')

/** 按 TypeBox 路径取子值（如 `/child/0`） */
const valueAtTypeboxPath = (root: unknown, path: string): unknown => {
  if (path === '') return root
  let cur: unknown = root
  for (const part of path.split('/').filter(Boolean)) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

/**
 * 展开 Expected union value：
 * - 目标是数组且联合含 array 分支（child = string | SlideNode[]）→ 逐项按 tag 展开
 * - 目标是 ppt 元素（tag ∈ pptElementVariants）→ validatePptElement
 * - 否则按 anyOf 分支的 tag const 匹配后精确校验（Table Col/Tr、Ul Li 等）
 */
const expandUnionError = (e: ValueErrorLike, root: unknown): string[] => {
  const target = valueAtTypeboxPath(root, e.path)
  const prefix = typeboxPathToField(e.path)
  const withPrefix = (msgs: string[]): string[] =>
    msgs.map((m) => (prefix ? nestFieldError(prefix, m) : m))

  // childUnion（string | array）：子项非法时 TypeBox 只在 /child 报 union，不进 /child/0
  if (Array.isArray(target)) {
    const itemsSchema = (e.schema?.anyOf ?? []).find((b) => b.type === 'array')?.items
    return target.flatMap((item, index) => {
      const itemPrefix = prefix ? `${prefix}.${index}` : String(index)
      if (
        item &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        isPptElementTag((item as { tag?: unknown }).tag)
      ) {
        return validatePptElement(item).map((m) => nestFieldError(itemPrefix, m))
      }
      if (itemsSchema?.anyOf) {
        return expandUnionError(
          {
            path: `${e.path}/${index}`,
            message: 'Expected union value',
            schema: itemsSchema
          },
          root
        )
      }
      return [`字段 ${itemPrefix} 取值不合法`]
    })
  }

  if (
    target &&
    typeof target === 'object' &&
    isPptElementTag((target as { tag?: unknown }).tag)
  ) {
    return withPrefix(validatePptElement(target))
  }

  const matched = (e.schema?.anyOf ?? []).find((branch) => {
    const tagConst = branch.properties?.tag?.const
    return (
      tagConst !== undefined &&
      target !== null &&
      typeof target === 'object' &&
      !Array.isArray(target) &&
      (target as { tag?: unknown }).tag === tagConst
    )
  })
  if (!matched) {
    return withPrefix(
      collectErrors(Type.Union((e.schema?.anyOf ?? []).map((b) => Type.Unsafe(b))), target)
    )
  }

  const branchSchema = Type.Unsafe(matched) as TSchema
  try {
    const nestedRaw = [...Value.Errors(branchSchema, target)] as unknown as ValueErrorLike[]
    return [
      ...collectErrors(branchSchema, target, {
        ignore: (ne) => ne.message === 'Expected union value'
      }).map((m) => (prefix ? nestFieldError(prefix, m) : m)),
      ...nestedRaw
        .filter((ne) => ne.message === 'Expected union value')
        .flatMap((ne) => expandUnionError({ ...ne, path: `${e.path}${ne.path}` }, root))
    ]
  } catch {
    // Recursive $ref 解引用失败时退回 opaque（极少见；ppt 元素路径已由 variants 覆盖）
    return withPrefix([`取值不合法（允许：${PPT_ELEMENT_TYPES.join(' / ')}）`])
  }
}

/**
 * 校验单个元素：先按 tag 判别到对应分支 schema（未知 tag / 缺 tag 给出明确提示），
 * 再做精确字段校验。child 递归按 tag 展开——TypeBox Recursive Union 失败时只报
 * Expected union value，无法定位到 attr.xxx，故不能直接 collectErrors(递归联合)。
 */
export const validatePptElement = (value: unknown): string[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['元素必须是 JSON 对象']
  normalizePptNodeTree(value)
  const tag = (value as { tag?: unknown }).tag
  if (typeof tag !== 'string') {
    return [`元素缺少 tag 字段（可用：${PPT_ELEMENT_TYPES.join(' / ')}）`]
  }
  const variant = pptElementVariants[tag]
  if (!variant) {
    return [`未知元素类型「${tag}」（可用：${PPT_ELEMENT_TYPES.join(' / ')}）`]
  }

  const raw = [...Value.Errors(variant, value)] as unknown as ValueErrorLike[]
  const unionErrs = raw.filter((e) => e.message === 'Expected union value')
  return [
    ...collectErrors(variant, value, { ignore: (e) => e.message === 'Expected union value' }),
    ...unionErrs.flatMap((e) => expandUnionError(e, value))
  ]
}

/** 校验元素数组（1..N，每元素按 type 判别精确校验） */
export const validatePptElements = (value: unknown): string[] => {
  if (!Array.isArray(value)) return ['elements 必须是数组']
  if (value.length === 0) {
    return ['elements 不能为空：页面至少包含 1 个元素（根元素建议为 VStack / HStack 布局容器）']
  }
  const errors: string[] = []
  value.forEach((element, index) => {
    errors.push(
      ...validatePptElement(element).map((message) => `第 ${index + 1} 个元素：${message}`)
    )
  })
  return errors
}

/** 校验 Theme 令牌表：token 名合法 + 值 6 位 hex（# 可选） */
export const validatePptTheme = (theme: unknown): string[] => {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme))
    return ['theme 必须是对象（token 名 → 颜色）']
  const errors: string[] = []
  for (const [key, value] of Object.entries(theme)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(key)) {
      errors.push(`theme 令牌名「${key}」非法（以字母开头，可含字母 / 数字 / _ / -）`)
    }
    if (typeof value !== 'string' || !/^#?[0-9a-fA-F]{6}$/.test(value)) {
      errors.push(
        `theme 令牌「${key}」的颜色值「${String(value)}」非法（应为 6 位 hex，如 FFFFFF）`
      )
    }
  }
  return errors
}

/** 校验 patch：非 child 字段走 TypeBox；child 数组逐项 validatePptElement */
const validatePptElementPatch = (patch: unknown, fieldPrefix: string): string[] => {
  if (patch === undefined) return []
  normalizePptNodeTree(patch)
  const errors = collectErrors(pptElementPatchSchemaT, patch, {
    ignore: (e) => e.message === 'Expected union value' && e.path.startsWith('/child/')
  }).map((m) => nestFieldError(fieldPrefix, m))

  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return errors
  const child = (patch as { child?: unknown }).child
  if (!Array.isArray(child)) return errors
  child.forEach((item, index) => {
    errors.push(
      ...validatePptElement(item).map((m) => nestFieldError(`${fieldPrefix}.child.${index}`, m))
    )
  })
  return errors
}

// ── 批量操作 schema（ppt_batch_edit 用；op 判别联合，仿 canvas canvasSchemas.batchOpSchemaT） ──

const insertOpSchemaT = Type.Object(
  {
    op: Type.Literal('insert'),
    as: Type.Optional(
      Type.String({ description: '绑定名：同批内后续 op 用 parent:"@绑定名" 引用刚插入的节点' })
    ),
    parent: Type.String({
      description: '父位置："root"（页根）或容器节点 id 或 "@绑定名"'
    }),
    node: pptElementSchemaT
  },
  { additionalProperties: false, description: '插入元素到页根或容器子元素' }
)

const copyOpSchemaT = Type.Object(
  {
    op: Type.Literal('copy'),
    as: Type.Optional(Type.String({ description: '绑定名' })),
    id: Type.String({
      description: '被复制节点 id（本页内；可用 "@绑定名" 引用同批刚创建的节点）'
    }),
    parent: Type.String({ description: '目标父位置："root" 或容器节点 id 或 "@绑定名"' }),
    overrides: Type.Optional(pptElementPatchSchemaT)
  },
  { additionalProperties: false, description: '深拷贝节点到目标父（子树 id 重新生成）' }
)

const updateOpSchemaT = Type.Object(
  {
    op: Type.Literal('update'),
    id: Type.String({
      description: '目标节点 id（本页内，ppt_get_nodes 获取；可用 "@绑定名" 引用同批刚创建的节点）'
    }),
    patch: pptElementPatchSchemaT
  },
  { additionalProperties: false, description: '按节点 id 精准编辑（attr 合并 / text 覆盖 / child 替换）' }
)

const moveOpSchemaT = Type.Object(
  {
    op: Type.Literal('move'),
    id: Type.String({ description: '被移动节点 id（可用 "@绑定名" 引用同批刚创建的节点）' }),
    parent: Type.Optional(
      Type.String({ description: '新父位置："root" 或容器节点 id 或 "@绑定名"；缺省保持原父' })
    ),
    index: Type.Optional(Type.Number({ description: '兄弟节点中的位置索引，缺省放末尾' }))
  },
  { additionalProperties: false, description: '移动 / 重排节点（可跨容器）' }
)

const deleteOpSchemaT = Type.Object(
  {
    op: Type.Literal('delete'),
    id: Type.String({
      description: '目标节点 id（含子树一并删除；可用 "@绑定名" 引用同批刚创建的节点）'
    })
  },
  { additionalProperties: false, description: '删除节点（含子树）' }
)

/** 批量操作单条 schema（op 判别联合） */
export const pptBatchOpSchemaT = Type.Union(
  [insertOpSchemaT, copyOpSchemaT, updateOpSchemaT, moveOpSchemaT, deleteOpSchemaT],
  { description: '批量编辑操作（insert / copy / update / move / delete）' }
)

/** 批量操作数组 schema：≤15 个/批（元素过多 AI 生成的 JSON 容易出错） */
export const pptBatchOpsSchemaT = Type.Array(pptBatchOpSchemaT, {
  maxItems: 15,
  description: '批量操作列表（1-15 个，按顺序执行；insert / copy 可用 as 绑定名供后续 op 引用）'
})

const opSchemaMap = {
  insert: insertOpSchemaT,
  copy: copyOpSchemaT,
  update: updateOpSchemaT,
  move: moveOpSchemaT,
  delete: deleteOpSchemaT
} as const

/** 批量操作单条 schema（喂给模型的 ToolProperty 参数描述） */
export const pptBatchOpSchema: ToolProperty = toToolProperty(pptBatchOpSchemaT)

/** 批量操作数组 schema（喂给模型的 ToolProperty 参数描述） */
export const pptBatchOpsSchema: ToolProperty = toToolProperty(pptBatchOpsSchemaT)

/** 校验单个批量操作（按 op 判别到对应子 schema，精确中文错误） */
export const validatePptBatchOp = (op: unknown): string[] => {
  if (!op || typeof op !== 'object' || Array.isArray(op)) return ['操作必须是 JSON 对象']
  const opName = (op as { op?: unknown }).op
  if (typeof opName !== 'string') return ['缺少 op 字段']
  const variant = opSchemaMap[opName as keyof typeof opSchemaMap]
  if (!variant) return [`op 必须是 insert / copy / update / move / delete 之一，收到 ${opName}`]

  if (opName === 'insert') {
    const rec = op as { node?: unknown }
    const messages = [
      ...collectErrors(variant, op, {
        ignore: (e) => e.path === '/node' && e.message === 'Expected union value'
      }),
      ...(rec.node !== undefined
        ? validatePptElement(rec.node).map((m) => nestFieldError('node', m))
        : [])
    ]
    // child 写错位置的专属指路（模型惯性高发：子树写到操作级、文字写到 attr.child）
    if ('child' in rec) {
      messages.push(
        'insert 无操作级 child 字段：子元素请嵌套在 node.child 数组内（支持一次递归嵌套整棵子树）'
      )
    }
    if (messages.some((m) => m.includes('attr.child'))) {
      messages.push(
        '文本内容应写在节点顶层 child 字符串（如 {"tag":"Text","attr":{...},"child":"文字"}），attr 内没有 child 键'
      )
    }
    return messages
  }

  if (opName === 'update') {
    const rec = op as { patch?: unknown }
    // patch 整段改由 validatePptElementPatch（否则 child 递归联合只报 opaque）
    const shell = collectErrors(variant, op, {
      ignore: (e) => e.path === '/patch' || e.path.startsWith('/patch/')
    })
    if (!('patch' in rec)) return [...shell, '字段 patch 缺少必填']
    return [...shell, ...validatePptElementPatch(rec.patch, 'patch')]
  }

  if (opName === 'copy') {
    const rec = op as { overrides?: unknown }
    return [
      ...collectErrors(variant, op, {
        ignore: (e) => e.path === '/overrides' || e.path.startsWith('/overrides/')
      }),
      ...validatePptElementPatch(rec.overrides, 'overrides')
    ]
  }

  return collectErrors(variant, op)
}

/** 校验批量操作数组：必须是数组、1-15 个、逐条精确校验 */
export const validatePptBatchOps = (ops: unknown): string[] => {
  if (!Array.isArray(ops)) return ['operations 必须是数组']
  if (ops.length === 0) return ['operations 不能为空：至少 1 个操作']
  if (ops.length > 15) {
    return ['operations 超过上限：每批最多 15 个操作（元素过多 AI 生成的 JSON 容易出错，请分批处理）']
  }
  const errors: string[] = []
  ops.forEach((op, index) => {
    errors.push(...validatePptBatchOp(op).map((message) => `第 ${index + 1} 个操作：${message}`))
  })
  return errors
}
