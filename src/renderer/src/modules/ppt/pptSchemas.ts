/**
 * PPT 元素 schema 校验与模型侧参数描述（TypeBox 单一源）。
 * 节点结构定义见 pptElementSchemas.ts，本文件只做转换与运行时校验：
 * - pptElementSchema / pptElementsSchema：喂给模型的 ToolProperty 参数描述
 * - validatePptElement / validatePptElements / validatePptTheme：入参拦截（中文报错反馈模型自纠）
 */
import { collectErrors, toToolProperty } from '@/modules/tool/typeboxUtil'
import type { ToolProperty } from '@/domain'
import { pptElementSchemaT, pptElementVariants, pptElementsSchemaT } from './pptElementSchemas'
import { Type } from '@sinclair/typebox'

/** 元素 schema（供模型了解 batch_edit 的 elements 元素结构） */
export const pptElementSchema: ToolProperty = toToolProperty(pptElementSchemaT)

/** 元素数组 schema（供模型了解 add_slide / batch_edit 的 elements 参数） */
export const pptElementsSchema: ToolProperty = toToolProperty(pptElementsSchemaT)

/** ppt_edit_element 的 patch 参数 schema：attr 合并 / text 覆盖 / child 替换（任意组合） */
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

/**
 * 校验单个元素：先按 tag 判别到对应分支 schema（未知 tag / 缺 tag 给出明确提示），
 * 再做精确字段校验（含 child 递归，递归内错误定位到子元素位置）。
 */
export const validatePptElement = (value: unknown): string[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['元素必须是 JSON 对象']
  const tag = (value as { tag?: unknown }).tag
  if (typeof tag !== 'string') {
    return [`元素缺少 tag 字段（可用：${PPT_ELEMENT_TYPES.join(' / ')}）`]
  }
  const variant = pptElementVariants[tag]
  if (!variant) {
    return [`未知元素类型「${tag}」（可用：${PPT_ELEMENT_TYPES.join(' / ')}）`]
  }
  return collectErrors(variant, value)
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
