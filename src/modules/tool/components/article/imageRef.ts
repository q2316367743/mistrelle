/**
 * 文章 md 图片引用处理：本地相对路径预览解析 + 资产收集 + 导出。
 * md 内图片一律使用相对路径（如 ../assets/xxx.png，相对 md 所在目录），保证可导出、可移植。
 */

const EXTERNAL_RE = /^(https?:|data:|file:|blob:|mailto:|#)/i

/** 判断是否为本地相对路径（排除外链 / 绝对路径） */
const isRelative = (src: string): boolean =>
  !!src && !EXTERNAL_RE.test(src) && !src.startsWith('/') && !/^[a-zA-Z]:[\\/]/.test(src)

const resolveRel = (mdDir: string, src: string): string => window.preload.path.resolve(mdDir, src)

/**
 * 预览用：把 md 中相对路径图片解析为 file:// 绝对链接（返回新字符串，不改源文件）。
 * ChatContent 的 marked 引擎不支持自定义 image renderer，故渲染前预处理。
 */
export const resolveArticleMarkdown = (md: string, mdDir: string): string =>
  md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, raw) => {
    const src = (raw ?? '').trim()
    if (!isRelative(src)) return match
    return `![${alt}](${window.preload.net.pathToHref(resolveRel(mdDir, src))})`
  })

export interface ArticleAssetRef {
  /** md 中写的相对引用（相对 mdDir） */
  relToMd: string
  /** 解析后的绝对路径 */
  absPath: string
}

/** 收集 md 内引用的本地图片（仅相对路径、按绝对路径去重） */
export const collectArticleAssets = (md: string, mdDir: string): ArticleAssetRef[] => {
  const assets: ArticleAssetRef[] = []
  const seen = new Set<string>()
  md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, _alt, raw) => {
    const src = (raw ?? '').trim()
    if (!isRelative(src)) return ''
    const absPath = resolveRel(mdDir, src)
    if (seen.has(absPath)) return ''
    seen.add(absPath)
    assets.push({ relToMd: src, absPath })
    return ''
  })
  return assets
}

/**
 * 计算 abs 相对 root 的路径（PathApi 未提供 relative，基于 normalizePath 字符串实现）。
 * abs 不在 root 下（如 md 用 ../../ 逃出项目根）返回空串，导出时跳过。
 */
const relToRoot = (root: string, abs: string): string => {
  const r = window.preload.path.normalizePath(root).replace(/\/+$/, '')
  const a = window.preload.path.normalizePath(abs)
  if (a === r) return ''
  if (!a.startsWith(r + '/')) return ''
  return a.slice(r.length + 1)
}

export interface ExportArticleOptions {
  /** 项目根（articles/ 目录） */
  root: string
  /** 文章正文文件相对 root 的路径（如 drafts/xxx.md） */
  articleFile: string
  /** 目标导出目录 */
  targetDir: string
}

export interface ExportArticleResult {
  /** 导出后的 md 文件路径 */
  mdPath: string
  /** 导出的图片路径列表 */
  assets: string[]
}

/**
 * 导出文章（含引用的本地图片）到目标目录。
 * 保持相对结构：md 与图片按相对 root 的位置拷贝，md 内相对引用（../assets/xxx.png）在导出目录中依然有效。
 */
export const exportArticle = async (options: ExportArticleOptions): Promise<ExportArticleResult> => {
  const { root, articleFile, targetDir } = options
  const srcMd = window.preload.path.join(root, articleFile)
  const mdDir = window.preload.path.dirname(srcMd)
  if (!window.preload.fs.existsSync(srcMd)) {
    throw new Error(`文章文件不存在：${srcMd}`)
  }

  const mdText = await window.preload.fs.readTextFile(srcMd)
  const refs = collectArticleAssets(mdText, mdDir)
  const copiedAssets: string[] = []

  for (const ref of refs) {
    if (!window.preload.fs.existsSync(ref.absPath)) continue
    const rel = relToRoot(root, ref.absPath)
    if (!rel) continue
    const target = window.preload.path.join(targetDir, rel)
    await window.preload.fs.mkdir(window.preload.path.dirname(target))
    await window.preload.fs.copyFile(ref.absPath, target)
    copiedAssets.push(target)
  }

  const mdTarget = window.preload.path.join(targetDir, articleFile)
  await window.preload.fs.mkdir(window.preload.path.dirname(mdTarget))
  await window.preload.fs.copyFile(srcMd, mdTarget)

  return { mdPath: mdTarget, assets: copiedAssets }
}
