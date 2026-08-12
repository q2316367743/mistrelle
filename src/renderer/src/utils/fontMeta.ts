/**
 * 字体分类元数据（fontMeta）：类型/风格/字重/授权/语言的启发式关键词推断 + 统一过滤。
 *
 * 数据优先级：持久化的 item.meta（资源库 index.json / 系统字体 font-cache.json）> 按名称启发式推断。
 * 启发式仅对名称关键词尽力而为：类型/字重/语言较可靠，风格/授权多数归「其它/作者声明」。
 * font_list 工具与资源管理页筛选共用本模块，保证过滤语义一致。
 */

/** 五维过滤参数（含「全部」= 不限；空串 / 缺省同样视为不限）。值以 string 承载，运行时由选项列表约束 */
export interface FontMetaFilter {
  type?: string
  style?: string
  weight?: string
  license?: string
  language?: string
}

const FILTER_KEYS = ['type', 'style', 'weight', 'license', 'language'] as const

/** 各维度选项（含「全部」），font_list 工具 enum 与资源管理页下拉共用 */
export const FONT_TYPE_OPTIONS: (FontType | '全部')[] = [
  '全部',
  '黑体',
  '宋体',
  '圆体',
  '创意',
  '仿宋',
  '书法',
  '手写',
  '楷体',
  '隶书',
  '行书',
  '草书',
  '像素',
  '其它'
]
export const FONT_STYLE_OPTIONS: (FontStyle | '全部')[] = [
  '全部',
  '简约',
  '现代',
  '古典',
  '中国风',
  '手写风',
  '稳重',
  '有趣',
  '卡通',
  '尖锐',
  '力量',
  '豪放',
  '复古',
  '科技感',
  '可爱',
  '涂鸦',
  '像素',
  '活字风',
  '花式',
  'AI生成',
  '其它'
]
export const FONT_WEIGHT_OPTIONS: (FontWeightCategory | '全部')[] = [
  '全部',
  '纤细',
  '细',
  '正常',
  '粗',
  '超粗',
  '多字重',
  '可变'
]
export const FONT_LICENSE_OPTIONS: (FontLicense | '全部')[] = [
  '全部',
  '作者声明',
  'OFL',
  'IPA',
  'MIT',
  'GPL',
  'CC-BY',
  'CC0',
  '1.0',
  '自由共享',
  '开放授权',
  'APR',
  'APL',
  'YDOFL',
  'ISAS'
]
export const FONT_LANG_OPTIONS: (FontLanguage | '全部')[] = [
  '全部',
  '简体中文',
  '繁体中文',
  '日文',
  '韩文'
]

/** t-select 下拉选项：把字符串选项数组映射为 { label, value }（EnumOne 也接受字符串，但 t-select 需要对象） */
export const toSelectOptions = (options: readonly string[]): Array<{ label: string; value: string }> =>
  options.map((o) => ({ label: o, value: o }))

export const FONT_TYPE_SELECT = toSelectOptions(FONT_TYPE_OPTIONS)
export const FONT_STYLE_SELECT = toSelectOptions(FONT_STYLE_OPTIONS)
export const FONT_WEIGHT_SELECT = toSelectOptions(FONT_WEIGHT_OPTIONS)
export const FONT_LICENSE_SELECT = toSelectOptions(FONT_LICENSE_OPTIONS)
export const FONT_LANG_SELECT = toSelectOptions(FONT_LANG_OPTIONS)

/** 纯 ASCII 单词（含连字符）按 token 精确匹配，避免子串误伤（如 light 命中 Moonlight）；其余按子串匹配 */
const hasKw = (name: string, kw: string): boolean => {
  const lower = name.toLowerCase()
  if (/^[a-z0-9-]+$/.test(kw)) {
    const tokens = lower.split(/[^a-z0-9]+/).filter(Boolean)
    const k = kw.replace(/-/g, '')
    if (kw.includes('-')) return tokens.join('').includes(k)
    return tokens.includes(k)
  }
  return lower.includes(kw.toLowerCase())
}

/** FontMeta 全部取值（属性名之外的实际值联合），供规则表泛型约束 */
type FontMetaValue = FontMeta[keyof FontMeta]

const matchRule = <V extends FontMetaValue>(
  rules: ReadonlyArray<{ key: V; keywords: string[] }>,
  name: string,
  fallback: V
): V => {
  const rule = rules.find((r) => r.keywords.some((kw) => hasKw(name, kw)))
  return rule ? rule.key : fallback
}

const ruleFor = <V extends FontMetaValue>(key: V, keywords: string[]) => ({ key, keywords })

const TYPE_RULES = [
  ruleFor('仿宋', ['仿宋', 'fangsong', 'fangsong_gb2312']),
  ruleFor('黑体', ['黑体', '黑', '雅黑', 'hei', 'heiti', 'yahei', 'pingfang', 'sans']),
  ruleFor('宋体', ['宋体', '宋', '明', '明朝', 'song', 'sung', 'ming', 'serif', '衬线', 'mincho']),
  ruleFor('圆体', ['圆体', '圆', '丸', 'round', 'yuanti', 'maru']),
  ruleFor('楷体', ['楷', 'kai', 'kaiti', 'kaisti']),
  ruleFor('隶书', ['隶书', 'lisu', 'lishu']),
  ruleFor('行书', ['行书', '行楷', 'xing', 'hsing']),
  ruleFor('草书', ['草书', 'cao', 'cursive']),
  ruleFor('书法', ['书法', '毛笔', '翰墨', 'calligraphy', 'brush', 'shufa']),
  ruleFor('手写', ['手写', '手札', '手绘', 'hand', 'handwriting', 'script', 'pen']),
  ruleFor('像素', ['像素', '点阵', 'pixel', 'pix', 'dotmatrix']),
  ruleFor('创意', ['创意', '艺术', '个性', '装饰', 'creative', 'art', 'decorative', 'designer', 'display']),
] as const satisfies ReadonlyArray<{ key: FontType; keywords: string[] }>

const STYLE_RULES = [
  ruleFor('像素', ['像素', '点阵', 'pixel', 'pix']),
  ruleFor('涂鸦', ['涂鸦', 'graffiti', 'doodle', 'scribble']),
  ruleFor('卡通', ['卡通', '漫画', 'cartoon', 'comic', 'chibi']),
  ruleFor('可爱', ['可爱', 'cute', 'sweet', 'kawaii']),
  ruleFor('手写风', ['手写', '手札', 'hand', 'handwriting', 'script', 'pen']),
  ruleFor('中国风', ['中国风', '国风', '东方', '水墨', 'chinese']),
  ruleFor('古典', ['古典', '传统', 'classic', 'antique', 'oldstyle', 'old-style', 'trajan']),
  ruleFor('复古', ['复古', 'retro', 'vintage', 'nostalgia', 'mid-century']),
  ruleFor('活字风', ['活字', 'letterpress', 'woodtype', 'wood-type']),
  ruleFor('花式', ['花式', '装饰', 'fancy', 'swash', 'ornate', 'flourish']),
  ruleFor('科技感', ['科技', '电子', 'tech', 'cyber', 'digital', 'neon', 'future', 'sci-fi', 'scifi']),
  ruleFor('尖锐', ['尖锐', 'sharp', 'spiky', 'angular']),
  ruleFor('力量', ['力量', '强硬', 'power', 'impact', 'stencil', 'strength']),
  ruleFor('豪放', ['豪放', '狂野', 'rough', 'grunge', 'explosive', 'brush']),
  ruleFor('有趣', ['有趣', 'fun', 'playful', 'quirky']),
  ruleFor('稳重', ['稳重', '正式', 'stable', 'solid', 'serious']),
  ruleFor('简约', ['简约', '极简', 'minimal', 'clean', 'simple', 'geometric', 'modern']),
  ruleFor('现代', ['现代', 'contemporary']),
  ruleFor('AI生成', ['ai生成', 'ai-generated', 'generated', 'ai']),
] as const satisfies ReadonlyArray<{ key: FontStyle; keywords: string[] }>

const WEIGHT_RULES = [
  ruleFor('可变', ['可变', 'variable', 'vf']),
  ruleFor('纤细', ['纤细', '极细', 'thin', 'hairline', 'ultralight', 'ultra-light']),
  ruleFor('细', ['细体', '细', 'light', 'extralight', 'extra-light', 'demilight']),
  ruleFor('超粗', ['超粗', '特粗', 'black', 'heavy', 'ultrabold', 'ultra-bold', 'extrabold', 'extra-bold']),
  ruleFor('粗', ['粗黑', '粗体', '粗', 'bold', 'semibold', 'semi-bold', 'demibold', 'demi-bold']),
  ruleFor('多字重', ['多字重', '全字重', 'multiweight', 'multi-weight']),
  ruleFor('正常', ['常规', '标准', '中等', 'regular', 'normal', 'book', 'medium', 'roman']),
] as const satisfies ReadonlyArray<{ key: FontWeightCategory; keywords: string[] }>

const LICENSE_RULES = [
  ruleFor('OFL', ['ofl', 'sil open font license', 'open font license']),
  ruleFor('IPA', ['ipa', 'ipaex', 'ipamj', 'ipa font license']),
  ruleFor('MIT', ['mit', 'mit license']),
  ruleFor('GPL', ['gpl', 'gnu general public']),
  ruleFor('CC0', ['cc0', 'cc-0', 'cc-zero', 'public domain']),
  ruleFor('CC-BY', ['cc-by', 'cc by', 'cc attribution', 'creative commons']),
  ruleFor('1.0', ['1.0']),
  ruleFor('自由共享', ['自由共享', 'free license', 'freely']),
  ruleFor('开放授权', ['开放授权', 'open license']),
  ruleFor('APR', ['apr']),
  ruleFor('APL', ['apl']),
  ruleFor('YDOFL', ['ydofl']),
  ruleFor('ISAS', ['isas']),
] as const satisfies ReadonlyArray<{ key: FontLicense; keywords: string[] }>

const LANG_RULES = [
  ruleFor('繁体中文', ['繁体', '中文繁体', 'tc', 'traditional', 'big5']),
  ruleFor('日文', ['日文', '日本', 'jp', 'japanese', 'jis', 'mincho']),
  ruleFor('韩文', ['韩文', '韩', 'kr', 'korean', 'hangul', 'malgun', 'batang', 'gulim', 'dotum']),
] as const satisfies ReadonlyArray<{ key: FontLanguage; keywords: string[] }>

/** 按字体名启发式推断五维分类（推断失败维度返回各自兜底值） */
export const inferFontMeta = (name: string): FontMeta => ({
  type: matchRule(TYPE_RULES, name, '其它'),
  style: matchRule(STYLE_RULES, name, '其它'),
  weight: matchRule(WEIGHT_RULES, name, '正常'),
  license: matchRule(LICENSE_RULES, name, '作者声明'),
  language: matchRule(LANG_RULES, name, '简体中文')
})

/** 统一取字体元数据：持久化值优先，缺省按名称启发式推断 */
export const resolveFontMeta = <T extends FontItem>(item: T): T & { meta: FontMeta } => ({
  ...item,
  meta: item.meta ?? inferFontMeta(item.name)
})

/** 将「全部」/空串归一化为 undefined；用选项表校验并收窄到字面量联合（工具参数与 UI 传入的边界收敛） */
const pickDim = <T extends FontMetaValue>(
  options: readonly (T | '全部')[],
  value: string | undefined
): T | undefined => {
  if (!value || value === '全部') return undefined
  return (options as readonly string[]).includes(value) ? (value as T) : undefined
}

/** 归一化过滤参数：剔除「全部」与空值，仅保留实际指定的维度；全部为空返回 undefined（清除） */
export const normalizeMetaInput = (meta: FontMetaFilter): Partial<FontMeta> | undefined => {
  const out: Partial<FontMeta> = {}
  const type = pickDim(FONT_TYPE_OPTIONS, meta.type)
  if (type) out.type = type
  const style = pickDim(FONT_STYLE_OPTIONS, meta.style)
  if (style) out.style = style
  const weight = pickDim(FONT_WEIGHT_OPTIONS, meta.weight)
  if (weight) out.weight = weight
  const license = pickDim(FONT_LICENSE_OPTIONS, meta.license)
  if (license) out.license = license
  const language = pickDim(FONT_LANG_OPTIONS, meta.language)
  if (language) out.language = language
  return Object.keys(out).length ? out : undefined
}

/** 按五维过滤字体列表：每个字体先补齐 meta（持久化值 ?? 启发式），再逐维度比对；「全部」/空/缺省 = 不限 */
export const filterFontsByMeta = (fonts: readonly FontItem[], filter: FontMetaFilter): FontItemWithMeta[] => {
  return fonts
    .map(resolveFontMeta)
    .filter((f) =>
      FILTER_KEYS.every((k) => {
        const v = filter[k]
        return !v || v === '全部' || f.meta[k] === v
      })
    )
}
