
export type FontSource = 'system' | 'library' | 'online'

/** 字体类型（按字体名启发式推断，或用户入库/编辑时指定） */
export type FontType =
  | '黑体'
  | '宋体'
  | '圆体'
  | '创意'
  | '仿宋'
  | '书法'
  | '手写'
  | '楷体'
  | '隶书'
  | '行书'
  | '草书'
  | '像素'
  | '其它'

/** 字体风格（主观标签：启发式尽力而为，多数归「其它」；资源库/系统字体可被用户手动指定覆盖） */
export type FontStyle =
  | '简约'
  | '现代'
  | '古典'
  | '中国风'
  | '手写风'
  | '稳重'
  | '有趣'
  | '卡通'
  | '尖锐'
  | '力量'
  | '豪放'
  | '复古'
  | '科技感'
  | '可爱'
  | '涂鸦'
  | '像素'
  | '活字风'
  | '花式'
  | 'AI生成'
  | '其它'

/** 字体字重（按字体名关键词推断，缺省「正常」；「多字重/可变」仅在名称含对应标记时命中） */
export type FontWeightCategory = '纤细' | '细' | '正常' | '粗' | '超粗' | '多字重' | '可变'

/** 授权类型（缺省「作者声明」；命中 OFL/MIT/CC 等关键词时覆盖，或用户手动指定） */
export type FontLicense =
  | '作者声明'
  | 'OFL'
  | 'IPA'
  | 'MIT'
  | 'GPL'
  | 'CC-BY'
  | 'CC0'
  | '1.0'
  | '自由共享'
  | '开放授权'
  | 'APR'
  | 'APL'
  | 'YDOFL'
  | 'ISAS'

/** 字体语言（缺省「简体中文」；含 SC/TC/JP/KR 等语言标记时覆盖） */
export type FontLanguage = '简体中文' | '繁体中文' | '日文' | '英文'

/** 字体五维分类元数据（资源库/系统缓存可持久化；缺失时渲染层按名称启发式推断） */
export interface FontMeta {
  type: FontType
  style: FontStyle
  weight: FontWeightCategory
  license: FontLicense
  language: FontLanguage
}

export interface FontItem {
  /** 字体族名（name 表解析所得，供画布 text 节点 fontFamily 直接引用） */
  name: string
  /** 字体文件路径（系统字体 = 系统目录文件；资源库 = assets/fonts/ 下文件） */
  path: string
  /** 来源：system 系统字体 / library 资源库 / online 在线字体（预留） */
  source: FontSource
  /** 用户指定的分类元数据（资源库存于 assets/index.json、系统字体存于 font-cache.json）；缺省走启发式推断 */
  meta?: FontMeta
}

/** 已带分类元数据的字体项（meta 由持久化值或启发式推断补齐，渲染层统一使用） */
export interface FontItemWithMeta extends FontItem {
  meta: FontMeta
}

