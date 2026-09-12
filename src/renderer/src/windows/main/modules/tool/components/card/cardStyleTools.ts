// ==========================================
//  卡片风格管理工具：供「卡片样式生成」Agent 通过 tool call 增 / 改 / 查卡片风格
//  全部标记 internal：仅注册供该 agent 调用，不对外展示、不可分配给其他 agent
//  样式键值对的 schema（白名单键 / 取值约束）由注册表自动生成（describeCardStyleProps），
//  注册表扩展新属性后工具 schema 与提示词自动同步。
// ==========================================

import { ToolFunction, ToolProperty } from '@/domain'
import {
  CARD_STYLE_PROPS,
  describeCardStyleProps,
  normalizeCardStyleProps
} from '@/global/card-style-props'
import {
  describeCardStyleCss,
  describeCardStyleSlots,
  normalizeCardStyleCss,
  normalizeCardStyleTemplate
} from '@/global/card-style-template'
import { AiCardStyleForm } from '@/entity'
import { useAuthStore, useCardStyleStore } from '@/windows/main/store'

/** AI 生成卡片风格为会员权益：非会员 Agent 面不可见、工具写入兜底拒绝（手动表单新增不受限） */
const stylesLocked = () => !useAuthStore().features.extendedCardStyles

const STYLES_LOCKED_ERROR = 'AI 生成卡片风格为会员功能，请引导用户到 设置 → 账户 开通会员，或手动新建'

/** create/update 共用的样式键值对入参（键 = 注册表白名单，全部可选） */
const PROPS_PROPERTY: ToolProperty = {
  type: 'object',
  description: `样式键值对，只能使用以下白名单键（非法键会被剔除、非法值回落默认）：\n${describeCardStyleProps()}`,
  properties: Object.fromEntries(
    CARD_STYLE_PROPS.map((p) => [
      p.key,
      { type: 'string', description: `${p.label}${p.hint ? `（${p.hint}）` : ''}` }
    ])
  )
}

/** create/update 共用的自由层入参（HTML 模板 + 自定义 CSS） */
const TEMPLATE_PROPERTY: ToolProperty = {
  type: 'string',
  description: `HTML 模板（可选，整体替换；留空表示使用默认骨架）。${describeCardStyleSlots()}`
}

const CSS_PROPERTY: ToolProperty = {
  type: 'string',
  description: `自定义 CSS（可选，整体替换）。${describeCardStyleCss()}`
}

/** 概要信息（列表用，含完整样式供模型比对借鉴） */
const toSummary = (style: {
  id: string
  name: string
  description: string
  tags: Array<string>
  props: Record<string, string>
  template: string
  css: string
}) => ({
  id: style.id,
  name: style.name,
  description: style.description,
  tags: style.tags,
  props: style.props,
  template: style.template,
  css: style.css
})

export const cardStyleTools: ToolFunction[] = [
  {
    name: 'list_card_styles',
    label: '查询卡片风格列表',
    description:
      '列出系统中全部卡片风格（id、名称、简介、标签、样式键值对）。创建新风格前先查询已有风格与内置预设避免重复；修改前用于定位目标 id。',
    parameters: { type: 'object', properties: {} },
    risk: 'safe',
    internal: true,
    handler: async () => {
      const store = useCardStyleStore()
      const styles = stylesLocked()
        ? store.all.filter((s) => 'isSystem' in s && s.isSystem)
        : store.all
      return { styles: styles.map(toSummary) }
    }
  },
  {
    name: 'get_card_style',
    label: '查询卡片风格详情',
    description:
      '按 id 查询某个卡片风格的完整样式键值对。修改风格前必须先调用此工具获取当前配置，再基于现状产出修改。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '风格 id（可通过 list_card_styles 获取）' }
      },
      required: ['id']
    },
    risk: 'safe',
    internal: true,
    handler: async (...params: unknown[]) => {
      const { id } = params[0] as { id: string }
      const style = useCardStyleStore().getById(id)
      if (!style) return { error: `未找到 id 为 "${id}" 的卡片风格` }
      return { style: toSummary(style) }
    }
  },
  {
    name: 'create_card_style',
    label: '创建卡片风格',
    description:
      '创建一个新的卡片风格并立即保存。需提供名称（name）与样式定义（props 白名单键值对必填，可用可选的 template/css 自由层实现注册表表达不了的效果，如信纸横线、纹理装饰），创建风格时应给出完整协调的样式而不是零散几个键。创建成功后返回新风格的 id。',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '风格名称' },
        description: { type: 'string', description: '一句话简介' },
        tags: {
          type: 'array',
          description: '用户自定义标签',
          items: { type: 'string', description: '标签文本' }
        },
        props: PROPS_PROPERTY,
        template: TEMPLATE_PROPERTY,
        css: CSS_PROPERTY
      },
      required: ['name']
    },
    risk: 'sensitive',
    internal: true,
    handler: async (...params: unknown[]) => {
      const args = params[0] as {
        name?: string
        description?: string
        tags?: unknown[]
        props?: Record<string, unknown>
        template?: string
        css?: string
      }
      if (stylesLocked()) return { error: STYLES_LOCKED_ERROR }
      const name = args.name?.trim()
      if (!name) return { error: '风格名称（name）不能为空' }
      const form: AiCardStyleForm = {
        name,
        description: args.description?.trim() ?? '',
        tags: Array.isArray(args.tags) ? args.tags.map(String).slice(0, 10) : [],
        props: normalizeCardStyleProps(args.props),
        template: normalizeCardStyleTemplate(args.template),
        css: normalizeCardStyleCss(args.css)
      }
      const id = await useCardStyleStore().put(form)
      if (!id) return { error: '卡片风格创建失败，未生成 id' }
      return { id, name, message: '卡片风格创建成功，已出现在「卡片风格」列表中' }
    }
  },
  {
    name: 'update_card_style',
    label: '修改卡片风格',
    description:
      '按 id 修改已有卡片风格并立即保存。props 仅传入要变更的键（与当前值合并，白名单外键剔除）；template / css 为整体替换（不传 = 保持不变，传空串 = 清空回退默认骨架）。系统预设（isSystem）只读不可修改。建议先调用 get_card_style 获取当前配置。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '要修改的风格 id（可通过 list_card_styles 获取）' },
        name: { type: 'string', description: '风格名称' },
        description: { type: 'string', description: '一句话简介' },
        tags: {
          type: 'array',
          description: '用户自定义标签（整体替换）',
          items: { type: 'string', description: '标签文本' }
        },
        props: PROPS_PROPERTY,
        template: TEMPLATE_PROPERTY,
        css: CSS_PROPERTY
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
        tags?: unknown[]
        props?: Record<string, unknown>
        template?: string
        css?: string
      }
      const { id, ...rest } = args
      const store = useCardStyleStore()
      if (stylesLocked()) return { error: STYLES_LOCKED_ERROR }
      if (!id) return { error: '缺少风格 id' }
      if (store.isSystem(id)) return { error: '系统预设只读，不允许修改' }
      const old = store.getById(id)
      if (!old) return { error: `未找到 id 为 "${id}" 的卡片风格` }
      const form: AiCardStyleForm = {
        name: rest.name?.trim() || old.name,
        description: rest.description?.trim() || old.description,
        tags: Array.isArray(rest.tags) ? rest.tags.map(String).slice(0, 10) : old.tags,
        // 部分键更新：与当前值合并后再按注册表归一（非法键剔除 / 非法值回落）
        props: rest.props ? normalizeCardStyleProps({ ...old.props, ...rest.props }) : old.props,
        // 自由层整体替换：不传保持不变，传空串清空
        template:
          rest.template !== undefined ? normalizeCardStyleTemplate(rest.template) : old.template,
        css: rest.css !== undefined ? normalizeCardStyleCss(rest.css) : old.css
      }
      const saved = await store.put(form, id)
      if (!saved) return { error: '卡片风格修改失败' }
      return { id, name: form.name, message: '卡片风格修改成功' }
    }
  }
]
