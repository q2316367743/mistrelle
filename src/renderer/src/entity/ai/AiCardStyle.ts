import { BaseEntity } from '@/entity'
import {
  buildDefaultCardStyleProps,
  normalizeCardStyleProps
} from '@/global/card-style-props'

/**
 * 卡片风格（笔记卡片的外观约束）：
 * 样式为「注册表白名单内的键值对」，键必须来自 CARD_STYLE_PROPS（@/global/card-style-props），
 * 存储即 JSON 对象，扩展新样式属性无需改动实体与消费方。
 */
export interface AiCardStyleCore {
  /** 风格显示名称 */
  name: string
  /** 一句话简介 */
  description: string
  /** 用户自定义标签 */
  tags: Array<string>
  /** 样式键值对（键必须在注册表内，读写前经 normalizeCardStyleProps 归一） */
  props: Record<string, string>
}

/** 列表使用（index.json 索引项）；props 已含全部样式，列表卡片可直接整卡渲染 */
export interface AiCardStyleItem extends BaseEntity, AiCardStyleCore {}

/** 完整实体（card-style-{id}.json 单条文件） */
export interface AiCardStyle extends BaseEntity, AiCardStyleCore {
  /** 是否为系统预设（true 则不可编辑 / 删除） */
  isSystem: boolean
}

/** 表单（新建 / 编辑入参），与核心字段一致 */
export type AiCardStyleForm = AiCardStyleCore

/** 索引项归一化：白名单外键剔除、缺省键补 fallback，保证列表渲染健壮 */
export const normalizeCardStyleItem = (item: AiCardStyleItem): AiCardStyleItem => ({
  ...item,
  tags: item.tags ?? [],
  props: normalizeCardStyleProps(item.props)
})

/** 新建时的默认表单值 */
export const buildAiCardStyleForm = (): AiCardStyleForm => ({
  name: '',
  description: '',
  tags: [],
  props: buildDefaultCardStyleProps()
})

/** 完整实体 → 表单（编辑时回填；旧数据缺字段时兜底归一） */
export const toAiCardStyleForm = (style: AiCardStyle): AiCardStyleForm => ({
  name: style.name,
  description: style.description,
  tags: style.tags ?? [],
  props: normalizeCardStyleProps(style.props)
})
