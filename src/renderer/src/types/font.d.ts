/**
 * 字体相关类型（window.preload.font）。
 *
 * 统一字体项契约：系统字体 / 资源库字体都以 { name, path, source } 输出，
 * source 预留 'online'（在线字体未来下载到资源库 fonts/ 并标记，此版不实现）。
 * 渲染统一入口：system → Chromium 原生；library / online → 渲染进程 new FontFace。
 */
declare type FontSource = 'system' | 'library' | 'online'

/** 字体类型（按字体名启发式推断，或用户入库/编辑时指定） */
declare type FontType =
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
declare type FontStyle =
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
declare type FontWeightCategory = '纤细' | '细' | '正常' | '粗' | '超粗' | '多字重' | '可变'

/** 授权类型（缺省「作者声明」；命中 OFL/MIT/CC 等关键词时覆盖，或用户手动指定） */
declare type FontLicense =
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
declare type FontLanguage = '简体中文' | '繁体中文' | '日文' | '韩文'

/** 字体五维分类元数据（资源库/系统缓存可持久化；缺失时渲染层按名称启发式推断） */
declare interface FontMeta {
  type: FontType
  style: FontStyle
  weight: FontWeightCategory
  license: FontLicense
  language: FontLanguage
}

declare interface FontItem {
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
declare interface FontItemWithMeta extends FontItem {
  meta: FontMeta
}

declare interface FontApi {
  /** 合并系统字体 + 资源库字体，统一 { name, path, source }；资源库同名覆盖系统 */
  listFonts: () => Promise<FontItem[]>
  /** 系统字体列表（读缓存立即返回 + 后台刷新） */
  listSystemFonts: () => Promise<Array<Omit<FontItem, 'source'>>>
  /** 资源库字体列表（读 index.json + 文件存在性校验，零解析） */
  listLibrary: () => Promise<FontItem[]>
  /** 将字体文件入库：解析族名（失败回退文件名）→ 拷贝到 fonts/ → 写 index.json；meta 可选一并持久化 */
  addFont: (srcPath: string, meta?: Partial<FontMeta>) => Promise<FontItem & { error?: string }>
  /** 更新字体分类元数据：资源库字体写 assets/index.json，系统字体写 font-cache.json */
  updateFontMeta: (
    name: string,
    meta?: Partial<FontMeta>
  ) => Promise<{ name?: string; meta?: Partial<FontMeta>; error?: string }>
  /** 从资源库移除字体：删 index 条目 + 删文件 */
  removeFont: (name: string) => Promise<{ removed?: boolean; name?: string; error?: string }>
  /** 解析字体文件家族名；无法解析返回 null */
  parseFontFamilyName: (filePath: string) => Promise<string | null>
  /** 读取字体文件二进制，供渲染进程 new FontFace(name, buffer) */
  readFont: (filePath: string) => Promise<ArrayBuffer>
  /** 资源库目录（供资源管理页展示路径） */
  getAssetsDir: () => string
  /** 系统字体缓存文件路径 */
  getFontCachePath: () => string
}
