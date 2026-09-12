import { BaseEntity } from '@/entity'

/** 设计风格分组（产品 UI + 平面六组，与 web-image-skill 目录对齐） */
export const AI_DESIGN_STYLE_CATEGORIES = [
  'product-ui',
  'print-tradition',
  'art-movement',
  'east',
  'handmade',
  'pop-culture',
  'commercial'
] as const

export type AiDesignStyleCategory = (typeof AI_DESIGN_STYLE_CATEGORIES)[number]

/** 分类下拉选项（value 为稳定 slug，label 为展示名） */
export const DESIGN_STYLE_CATEGORY_OPTIONS: Array<{
  value: AiDesignStyleCategory
  label: string
}> = [
  { value: 'product-ui', label: '产品 UI' },
  { value: 'print-tradition', label: '印刷传统' },
  { value: 'art-movement', label: '艺术运动' },
  { value: 'east', label: '东方' },
  { value: 'handmade', label: '手作纸感' },
  { value: 'pop-culture', label: '流行文化' },
  { value: 'commercial', label: '影像商业' }
]

const LEGACY_DESIGN_STYLE_CATEGORY_MAP: Record<string, AiDesignStyleCategory> = {
  poster: 'commercial',
  移动端: 'product-ui',
  网页端: 'commercial'
}

/** 归一化分类；旧数据 poster / 移动端 / 网页端 映射到新分组 */
export const normalizeDesignStyleCategory = (
  value?: string
): AiDesignStyleCategory => {
  if (
    value &&
    (AI_DESIGN_STYLE_CATEGORIES as readonly string[]).includes(value)
  ) {
    return value as AiDesignStyleCategory
  }
  if (value && value in LEGACY_DESIGN_STYLE_CATEGORY_MAP) {
    return LEGACY_DESIGN_STYLE_CATEGORY_MAP[value]
  }
  return 'commercial'
}

export const getDesignStyleCategoryLabel = (
  category: AiDesignStyleCategory | string
): string =>
  DESIGN_STYLE_CATEGORY_OPTIONS.find(
    (o) => o.value === normalizeDesignStyleCategory(category)
  )?.label ?? String(category)

/** 按分组顺序聚合风格列表（空组自动剔除） */
export const groupDesignStylesByCategory = <
  T extends { category: AiDesignStyleCategory | string }
>(
  styles: T[]
): Array<{ category: AiDesignStyleCategory; label: string; items: T[] }> =>
  DESIGN_STYLE_CATEGORY_OPTIONS.map((opt) => ({
    category: opt.value,
    label: opt.label,
    items: styles.filter(
      (s) => normalizeDesignStyleCategory(s.category) === opt.value
    )
  })).filter((g) => g.items.length > 0)

export interface AiDesignStyleColorPalette {
  primary: string
  secondary: string
  background: string
  surface: string
  text_primary: string
  text_secondary: string
}

export interface AiDesignStyleTypographyItem {
  font: string
  weight: number
  size: number
  lineHeight: number
}

export interface AiDesignStyleTypography {
  heading: AiDesignStyleTypographyItem
  body: AiDesignStyleTypographyItem
  caption: AiDesignStyleTypographyItem
}

/** 边框样式选项（表单下拉） */
export const DESIGN_STYLE_BORDER_STYLES = ['solid', 'dashed', 'dotted', 'none'] as const
export type AiDesignStyleBorderStyle = (typeof DESIGN_STYLE_BORDER_STYLES)[number]

/** 留白三档（短边占比目标） */
export const DESIGN_STYLE_WHITESPACE_RATIOS = [35, 55, 70] as const
export type AiDesignStyleWhitespaceRatio = (typeof DESIGN_STYLE_WHITESPACE_RATIOS)[number]

export const DESIGN_STYLE_WHITESPACE_OPTIONS: Array<{
  value: AiDesignStyleWhitespaceRatio
  label: string
}> = [
  { value: 35, label: '35%（信息密度较高）' },
  { value: 55, label: '55%（均衡）' },
  { value: 70, label: '70%（极简留白）' }
]

/** 间距规范：外边距 / 内边距 / 间距基准 */
export interface AiDesignStyleSpacing {
  /** 页面安全边距（px） */
  pageMargin: number
  /** 区块 / 卡片间距（px） */
  sectionGap: number
  /** 卡片 / 容器内边距（px） */
  cardPadding: number
  /** 间距基准单位（px），间距体系按此缩放 */
  baseUnit: number
}

/** 圆角规范：三档 + 胶囊开关 */
export interface AiDesignStyleRadius {
  /** 小圆角：按钮 / 输入框（px） */
  small: number
  /** 常规圆角：卡片（px） */
  medium: number
  /** 大圆角：弹窗 / 横幅（px） */
  large: number
  /** 是否使用胶囊圆角（按钮全圆角） */
  pill: boolean
}

/** 边框规范 */
export interface AiDesignStyleBorder {
  /** 边框宽度（px） */
  width: number
  /** 边框样式 */
  style: AiDesignStyleBorderStyle
  /** 边框颜色（色值） */
  color: string
}

/** 阴影规范（单级、可开关） */
export interface AiDesignStyleShadow {
  /** 是否启用阴影 */
  enabled: boolean
  /** 水平偏移（px） */
  offsetX: number
  /** 垂直偏移（px） */
  offsetY: number
  /** 模糊半径（px） */
  blur: number
  /** 阴影颜色（含透明度，如 rgba(0,0,0,0.08)） */
  color: string
}

/** 动效规范 */
export interface AiDesignStyleMotion {
  /** 过渡基础时长（ms） */
  duration: number
  /** 缓动曲线（如 ease / cubic-bezier(0.2,0,0,1)） */
  easing: string
  /** 动效范围（如 hover / 切换 / 入场） */
  scope: string
}

/** 全局样式细节规范（tokens）：间距 / 圆角 / 边框 / 阴影 / 动效 */
export interface AiDesignStyleTokens {
  spacing: AiDesignStyleSpacing
  radius: AiDesignStyleRadius
  border: AiDesignStyleBorder
  shadow: AiDesignStyleShadow
  motion: AiDesignStyleMotion
}

export interface AiDesignStyleCore {
  // ========================== 基础层（身份与分类） ==========================

  /**
   * 风格显示名称
   */
  name: string
  /**
   * 一句话简介，展示在卡片下方
   */
  description: string
  /**
   * 适用场景分类
   */
  category: AiDesignStyleCategory
  /**
   * 用户自定义标签
   */
  tags: Array<string>
}

/**
 * 列表使用（index.json 索引项）
 * > 含配色方案与渲染规范（字体 / tokens / 留白），供列表卡片整卡按风格渲染，无需读单条文件
 */
export interface AiDesignStyleItem extends BaseEntity, AiDesignStyleCore {
  colorPalette: AiDesignStyleColorPalette
  /** 字体规范（标题 / 正文 / 辅助层级），卡片文字按此渲染 */
  typography: AiDesignStyleTypography
  /** 全局样式细节规范：间距 / 圆角 / 边框 / 阴影 / 动效，卡片外观按此渲染 */
  tokens: AiDesignStyleTokens
  /** 留白档位，映射卡片内边距密度 */
  whitespaceRatio: AiDesignStyleWhitespaceRatio
  /**
   * 来源：'market' = 从在线风格库下载（会员权益，断订后隐藏）；
   * 缺省 = 用户自造或旧数据，永久归用户所有
   */
  source?: 'market'
}

export interface AiDesignStyleForm extends AiDesignStyleCore {
  /**
   * 风格显示名称
   */
  name: string
  /**
   * 一句话简介，展示在卡片下方
   */
  description: string
  /**
   * 适用场景分类
   */
  category: AiDesignStyleCategory
  /**
   * 用户自定义标签
   */
  tags: Array<string>
  // ========================== AI执行层（生成控制核心）—— Agent读这个 ==========================

  /**
   * **正向风格描述词**：描述构图、光影、材质、氛围
   */
  visualPrompt: string
  /**
   * **反向排除词**：告诉AI不要出现什么
   */
  negativePrompt: string

  /**
   * 配色方案（需包含角色定义）
   */
  colorPalette: AiDesignStyleColorPalette

  /**
   * 字体规范（定义层级）
   */
  typography: AiDesignStyleTypography

  /**
   * 布局硬约束（针对生图模型 / 画布图层动作）
   */
  layoutRules: Array<string>

  /**
   * 全局样式细节规范（tokens）：间距 / 圆角 / 边框 / 阴影 / 动效
   */
  tokens: AiDesignStyleTokens

  // ========================== 风格配方层（辨识度） ==========================

  /**
   * 口头别名（点名匹配，如「瑞士」「国际主义」）
   */
  aliases: Array<string>
  /**
   * 签名手法：本风格独有的那一招；只换色板不算换风格
   */
  signature: string
  /**
   * 留白目标档位（短边占比约值）
   */
  whitespaceRatio: AiDesignStyleWhitespaceRatio
  /**
   * 常用画幅比例，如 '3:4' / '1.91:1' / '1:1'
   */
  preferredFormats: Array<string>
  /**
   * 适用场景简述
   */
  suitableFor: string
  /**
   * 不适用场景简述
   */
  unsuitableFor: string
}

export interface AiDesignStyle extends BaseEntity, AiDesignStyleForm {
  // ========================== 系统字段 ==========================

  /**
   * 是否为系统预设（true则不可删除）
   */
  isSystem: boolean
  /**
   * 来源：'market' = 从在线风格库下载（会员权益，断订后隐藏）；缺省 = 用户自造，永久归用户
   */
  source?: 'market'
}

/** tokens 默认值，并用默认值兜底合并部分传入（兼容旧数据 / agent 部分传参） */
export const buildAiDesignStyleTokens = (
  partial?: Partial<AiDesignStyleTokens>
): AiDesignStyleTokens => {
  const base: AiDesignStyleTokens = {
    spacing: { pageMargin: 16, sectionGap: 24, cardPadding: 16, baseUnit: 8 },
    radius: { small: 4, medium: 8, large: 16, pill: false },
    border: { width: 1, style: 'solid', color: '#e0e0e0' },
    shadow: { enabled: true, offsetX: 0, offsetY: 2, blur: 8, color: 'rgba(0,0,0,0.08)' },
    motion: { duration: 200, easing: 'ease', scope: 'hover / 切换 / 入场' }
  }
  if (!partial) return base
  return {
    spacing: { ...base.spacing, ...partial.spacing },
    radius: { ...base.radius, ...partial.radius },
    border: { ...base.border, ...partial.border },
    shadow: { ...base.shadow, ...partial.shadow },
    motion: { ...base.motion, ...partial.motion }
  }
}

/** 归一化留白档位；非法值回落 55 */
export const normalizeWhitespaceRatio = (
  value?: number
): AiDesignStyleWhitespaceRatio => {
  if (value === 35 || value === 55 || value === 70) return value
  return 55
}

/** typography 默认值，并用默认值兜底合并部分传入（兼容旧数据 / agent 部分传参） */
export const buildAiDesignStyleTypography = (
  partial?: Partial<AiDesignStyleTypography>
): AiDesignStyleTypography => {
  const base: AiDesignStyleTypography = {
    heading: { font: '', weight: 600, size: 28, lineHeight: 1.4 },
    body: { font: '', weight: 400, size: 16, lineHeight: 1.6 },
    caption: { font: '', weight: 400, size: 12, lineHeight: 1.5 }
  }
  if (!partial) return base
  return {
    heading: { ...base.heading, ...partial.heading },
    body: { ...base.body, ...partial.body },
    caption: { ...base.caption, ...partial.caption }
  }
}

/** 索引项归一化：旧 index.json 缺渲染规范字段时兜底补齐，保证列表卡片可按风格渲染 */
export const normalizeDesignStyleItem = (
  item: AiDesignStyleItem
): AiDesignStyleItem => ({
  ...item,
  category: normalizeDesignStyleCategory(item.category),
  colorPalette: item.colorPalette,
  typography: buildAiDesignStyleTypography(item.typography),
  tokens: buildAiDesignStyleTokens(item.tokens),
  whitespaceRatio: normalizeWhitespaceRatio(item.whitespaceRatio)
})

/** 新建时的默认表单值 */
export const buildAiDesignStyleForm = (): AiDesignStyleForm => ({
  name: '',
  description: '',
  category: 'commercial',
  tags: [],
  visualPrompt: '',
  negativePrompt: '',
  colorPalette: {
    primary: '#1677ff',
    secondary: '#5a9cf8',
    background: '#ffffff',
    surface: '#f2f3f5',
    text_primary: '#1f2329',
    text_secondary: '#6b7785'
  },
  typography: buildAiDesignStyleTypography(),
  layoutRules: [],
  tokens: buildAiDesignStyleTokens(),
  aliases: [],
  signature: '',
  whitespaceRatio: 55,
  preferredFormats: [],
  suitableFor: '',
  unsuitableFor: ''
})

/** 完整实体 → 表单（编辑时回填；旧数据缺字段时兜底） */
export const toAiDesignStyleForm = (style: AiDesignStyle): AiDesignStyleForm => ({
  name: style.name,
  description: style.description,
  category: normalizeDesignStyleCategory(style.category),
  tags: style.tags,
  visualPrompt: style.visualPrompt,
  negativePrompt: style.negativePrompt,
  colorPalette: style.colorPalette,
  typography: style.typography,
  layoutRules: style.layoutRules,
  tokens: buildAiDesignStyleTokens(style.tokens),
  aliases: style.aliases ?? [],
  signature: style.signature ?? '',
  whitespaceRatio: normalizeWhitespaceRatio(style.whitespaceRatio),
  preferredFormats: style.preferredFormats ?? [],
  suitableFor: style.suitableFor ?? '',
  unsuitableFor: style.unsuitableFor ?? ''
})
