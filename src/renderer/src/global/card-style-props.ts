/**
 * 卡片样式属性注册表（单一事实源）。
 *
 * 卡片风格不是自由 CSS，而是「注册表白名单 + JSON 键值对」：
 * - 样式 JSON 形如 { "card.background": "#fff", "title.size": "24px" }，键必须在注册表内
 * - 写入前经 normalizeCardStyleProps 校验：白名单外键剔除、类型非法回落 fallback
 *   （AI / 表单 / 旧数据统一走此入口，保证存盘的样式永远合法、可分享）
 * - 渲染 CSS 由 buildCardStyleCss 从注册表逐条生成（iframe 隔离渲染），
 *   AI 提示词清单由 describeCardStyleProps 自动生成，编辑表单控件由注册表驱动
 *
 * 扩展新样式 = 在 CARD_STYLE_PROPS 追加一条记录（声明 key / 校验 / fallback / css 规则），
 * 渲染、校验、表单、AI 提示词全部自动生效，无需改动任何消费方代码。
 */
import type { CommonSelect } from '@common/types/CommonSelect'

/** 属性值类型 */
export type CardStylePropType = 'color' | 'length' | 'enum' | 'number' | 'font'

/** 属性值类型中文名称映射 */
export const CARD_STYLE_PROP_TYPE_OPTIONS: Array<CommonSelect<CardStylePropType>> = [
  { value: 'color', label: '颜色' },
  { value: 'length', label: '尺寸' },
  { value: 'enum', label: '枚举' },
  { value: 'number', label: '数值' },
  { value: 'font', label: '字体' }
]

/** 属性分组（对应卡片 HTML 骨架的区域） */
export type CardStylePropGroup = 'card' | 'title' | 'author' | 'body' | 'quote' | 'image' | 'footer'

/** 属性分组中文名称映射 */
export const CARD_STYLE_GROUP_OPTIONS: Array<CommonSelect<CardStylePropGroup>> = [
  { value: 'card', label: '卡片整体' },
  { value: 'title', label: '标题' },
  { value: 'author', label: '作者' },
  { value: 'body', label: '正文' },
  { value: 'quote', label: '引用' },
  { value: 'image', label: '图片' },
  { value: 'footer', label: '页尾' }
]

/** 单个样式属性声明 */
export interface CardStyleProp {
  /** 样式 JSON 键（全库唯一，即白名单键） */
  key: string
  /** 中文名（编辑表单 label 与 AI 提示词共用） */
  label: string
  /** 所属分组 */
  group: CardStylePropGroup
  /** 值类型 */
  type: CardStylePropType
  /** enum 可选值（type=enum 时必填） */
  options?: Array<CommonSelect>
  /** length / number 的合法范围（含端点） */
  min?: number
  max?: number
  /** length 数值单位（当前统一 px，预留给未来其他单位） */
  unit?: string
  /** 兜底值：缺省 / 非法时回落；空字符串表示「不产出 CSS 规则」（如字体继承整体） */
  fallback: string
  /** AI 提示词补充说明 */
  hint?: string
  /** 合法值 → 该属性对应的 CSS 规则（空值不产出） */
  css: (value: string) => string
}

/** 颜色：hex（3/4/6/8 位）或 rgb/rgba */
const COLOR_PATTERN =
  /^(#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\))$/i

/** 字体名清洗：去引号 / 反斜杠 / 分号，防止破坏 CSS 结构 */
const sanitizeFontName = (value: string) => value.replace(/['"\\;]/g, '').trim().slice(0, 60)

/** 标题字重选项 */
const WEIGHT_OPTIONS: Array<CommonSelect> = [
  { value: '400', label: '常规' },
  { value: '500', label: '中等' },
  { value: '600', label: '半粗' },
  { value: '700', label: '加粗' },
  { value: '800', label: '特粗' }
]

/**
 * 属性注册表（新增样式只改这里）。
 * css 规则只允许作用于 iframe 骨架内的固定类名（.note-card / .nc-title / .nc-content）。
 */
export const CARD_STYLE_PROPS: Array<CardStyleProp> = [
  // ------------------------- 卡片整体 -------------------------
  {
    key: 'card.background',
    label: '卡片背景色',
    group: 'card',
    type: 'color',
    fallback: '#ffffff',
    css: (v) => `.note-card{background:${v}}`
  },
  {
    key: 'card.color',
    label: '全局文字色',
    group: 'card',
    type: 'color',
    fallback: '#333333',
    css: (v) => `.note-card{color:${v}}`
  },
  {
    key: 'card.radius',
    label: '卡片圆角',
    group: 'card',
    type: 'length',
    min: 0,
    max: 48,
    unit: 'px',
    fallback: '16px',
    css: (v) => `.note-card{border-radius:${v}}`
  },
  {
    key: 'card.padding',
    label: '卡片内边距',
    group: 'card',
    type: 'length',
    min: 12,
    max: 80,
    unit: 'px',
    fallback: '28px',
    css: (v) => `.note-card{padding:${v}}`
  },
  {
    key: 'card.font',
    label: '全局字体',
    group: 'card',
    type: 'font',
    fallback: '',
    hint: '留空表示系统默认字体',
    css: (v) => `.note-card{font-family:'${v}','PingFang SC','Microsoft YaHei',sans-serif}`
  },
  {
    key: 'card.accent',
    label: '强调色',
    group: 'card',
    type: 'color',
    fallback: '#ff5c5c',
    hint: '作用于加粗文字、链接与分隔线',
    css: (v) =>
      `.nc-content strong{color:${v}}.nc-content a{color:${v}}.nc-content hr{background:${v}}`
  },

  // ------------------------- 标题 -------------------------
  {
    key: 'title.color',
    label: '标题颜色',
    group: 'title',
    type: 'color',
    fallback: '#1f1f1f',
    css: (v) => `.nc-title{color:${v}}`
  },
  {
    key: 'title.size',
    label: '标题字号',
    group: 'title',
    type: 'length',
    min: 16,
    max: 48,
    unit: 'px',
    fallback: '26px',
    css: (v) => `.nc-title{font-size:${v}}`
  },
  {
    key: 'title.weight',
    label: '标题字重',
    group: 'title',
    type: 'enum',
    options: WEIGHT_OPTIONS,
    fallback: '700',
    css: (v) => `.nc-title{font-weight:${v}}`
  },
  {
    key: 'title.font',
    label: '标题字体',
    group: 'title',
    type: 'font',
    fallback: '',
    hint: '留空表示继承全局字体',
    css: (v) => `.nc-title{font-family:'${v}','PingFang SC','Microsoft YaHei',sans-serif}`
  },
  {
    key: 'title.align',
    label: '标题对齐',
    group: 'title',
    type: 'enum',
    options: [
      { value: 'left', label: '左对齐' },
      { value: 'center', label: '居中' }
    ],
    fallback: 'left',
    css: (v) => `.nc-title{text-align:${v}}`
  },
  {
    key: 'title.spacing',
    label: '标题下间距',
    group: 'title',
    type: 'length',
    min: 0,
    max: 48,
    unit: 'px',
    fallback: '16px',
    css: (v) => `.nc-title{margin-bottom:${v}}`
  },

  // ------------------------- 作者（首页卡头：头像 + 名字） -------------------------
  {
    key: 'author.color',
    label: '作者文字色',
    group: 'author',
    type: 'color',
    fallback: '#8a8a8a',
    css: (v) => `.nc-author{color:${v}}`
  },
  {
    key: 'author.size',
    label: '作者字号',
    group: 'author',
    type: 'length',
    min: 10,
    max: 20,
    unit: 'px',
    fallback: '13px',
    css: (v) => `.nc-author{font-size:${v}}`
  },

  // ------------------------- 正文 -------------------------
  {
    key: 'body.color',
    label: '正文颜色',
    group: 'body',
    type: 'color',
    fallback: '#3a3a3a',
    css: (v) => `.nc-content{color:${v}}`
  },
  {
    key: 'body.size',
    label: '正文字号',
    group: 'body',
    type: 'length',
    min: 12,
    max: 24,
    unit: 'px',
    fallback: '15px',
    css: (v) => `.nc-content{font-size:${v}}`
  },
  {
    key: 'body.lineHeight',
    label: '正文行高',
    group: 'body',
    type: 'number',
    min: 1.2,
    max: 2.4,
    fallback: '1.7',
    css: (v) => `.nc-content{line-height:${v}}`
  },
  {
    key: 'body.headingColor',
    label: '内容小标题色',
    group: 'body',
    type: 'color',
    fallback: '#1f1f1f',
    hint: '正文内 # 小标题的颜色',
    css: (v) =>
      `.nc-content h1,.nc-content h2,.nc-content h3,.nc-content h4,.nc-content h5,.nc-content h6{color:${v}}`
  },
  {
    key: 'body.highlight',
    label: '高亮底色',
    group: 'body',
    type: 'color',
    fallback: '#fff176',
    hint: '==文字== 高亮标记的底色',
    css: (v) => `.nc-content mark{background:${v};color:inherit;padding:0 2px;border-radius:2px}`
  },

  // ------------------------- 引用 -------------------------
  {
    key: 'quote.background',
    label: '引用底色',
    group: 'quote',
    type: 'color',
    fallback: '#f6f6f6',
    css: (v) => `.nc-content blockquote{background:${v}}`
  },
  {
    key: 'quote.barColor',
    label: '引用竖条色',
    group: 'quote',
    type: 'color',
    fallback: '#d0d0d0',
    css: (v) => `.nc-content blockquote{border-left-color:${v}}`
  },
  {
    key: 'quote.color',
    label: '引用文字色',
    group: 'quote',
    type: 'color',
    fallback: '#666666',
    css: (v) => `.nc-content blockquote{color:${v}}`
  },

  // ------------------------- 图片 -------------------------
  {
    key: 'image.radius',
    label: '图片圆角',
    group: 'image',
    type: 'length',
    min: 0,
    max: 32,
    unit: 'px',
    fallback: '8px',
    css: (v) => `.nc-content img{border-radius:${v}}`
  },
  {
    key: 'image.border',
    label: '图片描边色',
    group: 'image',
    type: 'color',
    fallback: '',
    hint: '留空表示无边框',
    css: (v) => `.nc-content img{border:1px solid ${v}}`
  },

  // ------------------------- 页尾（每张卡底部水印） -------------------------
  {
    key: 'footer.color',
    label: '页尾文字色',
    group: 'footer',
    type: 'color',
    fallback: '#b5b5b5',
    css: (v) => `.nc-footer{color:${v}}`
  },
  {
    key: 'footer.size',
    label: '页尾字号',
    group: 'footer',
    type: 'length',
    min: 9,
    max: 18,
    unit: 'px',
    fallback: '11px',
    css: (v) => `.nc-footer{font-size:${v}}`
  }
]

/** 注册表键集合（白名单，由 CARD_STYLE_PROPS 派生防失同步） */
export const CARD_STYLE_KEYS = CARD_STYLE_PROPS.map((p) => p.key)

/** 按注册表 key 精确取属性声明 */
export const getCardStyleProp = (key: string): CardStyleProp | undefined =>
  CARD_STYLE_PROPS.find((p) => p.key === key)

/** 单值校验：缺省 / 非法回落 fallback，合法返回归一后的字符串 */
export const normalizeCardStylePropValue = (prop: CardStyleProp, raw: unknown): string => {
  if (raw == null) return prop.fallback
  const str = String(raw).trim()
  if (!str) return prop.fallback
  switch (prop.type) {
    case 'color':
      return COLOR_PATTERN.test(str) ? str : prop.fallback
    case 'length': {
      const n = Number.parseFloat(str)
      if (Number.isNaN(n)) return prop.fallback
      if (n < (prop.min ?? 0) || n > (prop.max ?? Number.MAX_SAFE_INTEGER)) return prop.fallback
      return `${n}${prop.unit ?? 'px'}`
    }
    case 'number': {
      const n = Number.parseFloat(str)
      if (Number.isNaN(n)) return prop.fallback
      if (n < (prop.min ?? -Number.MAX_VALUE) || n > (prop.max ?? Number.MAX_VALUE))
        return prop.fallback
      return String(Math.round(n * 100) / 100)
    }
    case 'enum': {
      const values = (prop.options ?? []).map((o) => String(o.value))
      return values.includes(str) ? str : prop.fallback
    }
    case 'font':
      return sanitizeFontName(str)
  }
}

/**
 * 归一样式键值对：仅保留注册表白名单内的键（未知键剔除），
 * 每个键都补齐（缺省 / 非法回落 fallback），输出始终完整、可直接落盘与渲染。
 */
export const normalizeCardStyleProps = (
  raw?: Record<string, unknown> | null
): Record<string, string> =>
  Object.fromEntries(
    CARD_STYLE_PROPS.map((p) => [p.key, normalizeCardStylePropValue(p, raw?.[p.key])])
  )

/** 新建时的默认样式（全部 fallback） */
export const buildDefaultCardStyleProps = (): Record<string, string> => normalizeCardStyleProps()

/** 由样式键值对生成卡片 CSS（注册表逐条产出，空值跳过；供 iframe 注入） */
export const buildCardStyleCss = (props: Record<string, string>): string =>
  CARD_STYLE_PROPS.map((p) => {
    const v = props[p.key]
    return v ? p.css(v) : ''
  })
    .filter(Boolean)
    .join('\n')

/** 面向 AI 的属性清单（从注册表自动生成，含类型约束与可选值） */
export const describeCardStyleProps = (): string =>
  CARD_STYLE_GROUP_OPTIONS.map((g) => {
    const lines = CARD_STYLE_PROPS.filter((p) => p.group === g.value).map((p) => {
      let constraint: string
      switch (p.type) {
        case 'color':
          constraint = '#RRGGBB 色值'
          break
        case 'length':
          constraint = `数值（${p.unit ?? 'px'}，${p.min ?? 0}~${p.max}）`
          break
        case 'number':
          constraint = `数值（${p.min}~${p.max}）`
          break
        case 'enum':
          constraint = (p.options ?? [])
            .map((o) => `${o.value}=${o.label}`)
            .join(' / ')
          break
        case 'font':
          constraint = `本机字体名${p.hint ? `（${p.hint}）` : ''}`
          break
      }
      return `- ${p.key}（${p.label}）：${constraint}`
    })
    return `### ${g.value}（${g.label}）\n${lines.join('\n')}`
  }).join('\n\n')
