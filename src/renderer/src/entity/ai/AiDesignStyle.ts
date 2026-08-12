import { BaseEntity } from '@/entity'

export type AiDesignStyleCategory = 'poster' | '移动端' | '网页端'

/** 分类下拉选项（poster 为英文键，中文展示「海报」） */
export const DESIGN_STYLE_CATEGORY_OPTIONS: Array<{
  value: AiDesignStyleCategory
  label: string
}> = [
  { value: 'poster', label: '海报' },
  { value: '移动端', label: '移动端' },
  { value: '网页端', label: '网页端' }
]

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
 * > 含配色方案，供列表卡片直接预览色板，无需读单条文件
 */
export interface AiDesignStyleItem extends BaseEntity, AiDesignStyleCore {
  colorPalette: AiDesignStyleColorPalette
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
   * 布局硬约束（针对生图模型）
   */
  layoutRules: Array<string>
}

export interface AiDesignStyle extends BaseEntity, AiDesignStyleForm {
  // ========================== 系统字段 ==========================

  /**
   * 是否为系统预设（true则不可删除）
   */
  isSystem: boolean
}

/** 新建时的默认表单值 */
export const buildAiDesignStyleForm = (): AiDesignStyleForm => ({
  name: '',
  description: '',
  category: '移动端',
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
  typography: {
    heading: { font: '', weight: 600, size: 28, lineHeight: 1.4 },
    body: { font: '', weight: 400, size: 16, lineHeight: 1.6 },
    caption: { font: '', weight: 400, size: 12, lineHeight: 1.5 }
  },
  layoutRules: []
})

/** 完整实体 → 表单（编辑时回填） */
export const toAiDesignStyleForm = (style: AiDesignStyle): AiDesignStyleForm => ({
  name: style.name,
  description: style.description,
  category: style.category,
  tags: style.tags,
  visualPrompt: style.visualPrompt,
  negativePrompt: style.negativePrompt,
  colorPalette: style.colorPalette,
  typography: style.typography,
  layoutRules: style.layoutRules
})
