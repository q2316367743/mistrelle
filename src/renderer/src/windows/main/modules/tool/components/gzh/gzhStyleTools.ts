// ==========================================
//  公众号排版风格管理工具：供「公众号样式创建助手」通过 tool call 增 / 改 / 查排版风格
//  全部标记 internal：仅注册供该 agent 调用，不对外展示、不可分配给其他 agent。
//  styles 的键 = 元素选择器白名单（GZH_STYLE_ELEMENT_KEYS），值 = 完整内联 style 字符串
//  （公众号编辑器禁 <style> 标签与外部 CSS，样式必须全内联）。
// ==========================================

import { ToolFunction, ToolProperty } from '@/domain'
import { GZH_STYLE_ELEMENT_KEYS } from '@/windows/main/modules/gzh/gzhTypes'
import { normalizeGzhStyleMap, useGzhStyleStore } from '@/windows/main/store'

/** 元素键的 schema 描述（与白名单同源，扩展白名单后自动同步） */
const describeStyleKeys = (): string =>
  GZH_STYLE_ELEMENT_KEYS.map((key) => `- ${key}`).join('\n')

const STYLES_PROPERTY: ToolProperty = {
  type: 'object',
  description: [
    '样式键值对，键只能使用以下元素选择器白名单（非法键会被剔除），值为一整段内联 style 字符串：',
    describeStyleKeys(),
    '硬约束：正文 15-16px、line-height 1.8-1.95、按 677px 内容宽设计、段间距约 1em、首行不缩进、圆角 ≤8px；',
    'section 是容器根（可设字体 / 字色 / 行高 / 背景与内边距基调）；必须全内联，禁止外部 CSS / web 字体 / CSS 变量。'
  ].join('\n')
}

export const gzhStyleTools: ToolFunction[] = [
  {
    name: 'list_gzh_styles',
    label: '查询排版风格列表',
    description:
      '列出系统中全部公众号排版风格（内置预设与用户自建，含完整样式键值对）。创建新风格前先查询避免重复；修改前用于定位目标 id。',
    parameters: { type: 'object', properties: {} },
    risk: 'safe',
    internal: true,
    handler: async () => {
      const store = useGzhStyleStore()
      return {
        styles: store.all.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          isSystem: 'isSystem' in s ? s.isSystem : false,
          styles: s.styles
        }))
      }
    }
  },
  {
    name: 'get_gzh_style',
    label: '查询排版风格详情',
    description:
      '按 id 查询某个公众号排版风格的完整样式键值对。修改风格前必须先调用此工具获取当前配置，再基于现状产出修改。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '风格 id（可通过 list_gzh_styles 获取）' }
      },
      required: ['id']
    },
    risk: 'safe',
    internal: true,
    handler: async (...params: unknown[]) => {
      const { id } = params[0] as { id: string }
      const style = useGzhStyleStore().getById(id)
      if (!style) return { error: `未找到 id 为 "${id}" 的排版风格` }
      return { style }
    }
  },
  {
    name: 'create_gzh_style',
    label: '创建排版风格',
    description:
      '创建一个新的公众号排版风格并立即保存。需提供名称（name）与完整协调的 styles 样式键值对（不要只给零散几个键，正文层级要完整）。创建成功后返回新风格的 id。',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '风格名称' },
        description: { type: 'string', description: '一句话简介' },
        styles: STYLES_PROPERTY
      },
      required: ['name', 'styles']
    },
    risk: 'sensitive',
    internal: true,
    handler: async (...params: unknown[]) => {
      const args = params[0] as {
        name?: string
        description?: string
        styles?: Record<string, unknown>
      }
      const name = args.name?.trim()
      if (!name) return { error: '风格名称（name）不能为空' }
      const styles = normalizeGzhStyleMap(args.styles)
      if (!Object.keys(styles).length) return { error: 'styles 样式键值对不能为空' }
      const id = await useGzhStyleStore().put({ name, description: args.description?.trim() ?? '', styles })
      if (!id) return { error: '排版风格创建失败，未生成 id' }
      return { id, name, message: '排版风格创建成功，已出现在排版页的风格列表中' }
    }
  },
  {
    name: 'update_gzh_style',
    label: '修改排版风格',
    description:
      '按 id 修改已有公众号排版风格并立即保存。name / description 可选；styles 为整体替换（必须传完整协调的全量键值对，不是增量）。内置预设（isSystem）只读不可修改。建议先调用 get_gzh_style 获取当前配置。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '要修改的风格 id（可通过 list_gzh_styles 获取）' },
        name: { type: 'string', description: '风格名称' },
        description: { type: 'string', description: '一句话简介' },
        styles: STYLES_PROPERTY
      },
      required: ['id']
    },
    risk: 'sensitive',
    internal: true,
    handler: async (...params: unknown[]) => {
      const args = params[0] as {
        id?: string
        name?: string
        description?: string
        styles?: Record<string, unknown>
      }
      const { id } = args
      const store = useGzhStyleStore()
      if (!id) return { error: '缺少风格 id' }
      if (store.isSystem(id)) return { error: '内置预设只读，不允许修改' }
      const old = store.getById(id)
      if (!old) return { error: `未找到 id 为 "${id}" 的排版风格` }
      const name = args.name?.trim() || old.name
      const styles = args.styles ? normalizeGzhStyleMap(args.styles) : old.styles
      const saved = await store.put(
        { name, description: args.description?.trim() || old.description, styles },
        id
      )
      if (!saved) return { error: '排版风格修改失败' }
      return { id, name, message: '排版风格修改成功' }
    }
  }
]
