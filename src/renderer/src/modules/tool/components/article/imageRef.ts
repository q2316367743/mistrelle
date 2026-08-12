/**
 * 文章 md 图片引用处理：本地相对路径解析（编辑器显示）+ 资产收集 + zip 导出。
 * md 内图片一律使用相对路径（如 ../assets/xxx.png，相对 md 所在目录），保证可导出、可移植。
 */

const EXTERNAL_RE = /^(https?:|data:|file:|blob:|mailto:|#)/i

/** 判断是否为本地相对路径（排除外链 / 绝对路径） */
const isRelative = (src: string): boolean =>
  !!src && !EXTERNAL_RE.test(src) && !src.startsWith('/') && !/^[a-zA-Z]:[\\/]/.test(src)

const resolveRel = (mdDir: string, src: string): string => window.preload.path.resolve(mdDir, src)

/**
 * 编辑器显示用：把节点里相对路径图片解析为 file:// 绝对链接（不改节点 src，源真相仍是相对路径）。
 * 非相对路径（外链 / 绝对路径）原样返回。
 */
export const resolveArticleImage = (baseDir: string, src: string): string => {
  const trimmed = (src ?? '').trim()
  if (!isRelative(trimmed)) return src
  return window.preload.net.pathToHref(resolveRel(baseDir, trimmed))
}

/**
 * 计算 fromDir 到 target 的相对路径（PathApi 无 relative，基于 normalizePath 字符串实现）。
 * 如 mdDir（root/drafts）→ root/assets/x.png 返回 ../assets/x.png。
 */
const relPath = (fromDir: string, target: string): string => {
  const a = window.preload.path.normalizePath(fromDir).split('/')
  const b = window.preload.path.normalizePath(target).split('/')
  while (a.length && b.length && a[0] === b[0]) {
    a.shift()
    b.shift()
  }
  const ups = a.filter((s) => s && s !== '.').length
  return `${'../'.repeat(ups)}${b.filter((s) => s && s !== '.').join('/')}`
}

/** 计算 md 到资产文件（assets 目录下）的相对引用，供粘贴 / 拖入图片后插入节点 */
export const resolveAssetRel = (mdDir: string, assetPath: string): string =>
  relPath(mdDir, assetPath)

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

export interface ExportArticleZipOptions {
  /** 项目根（articles/ 目录） */
  root: string
  /** 文章正文文件相对 root 的路径（如 drafts/xxx.md） */
  articleFile: string
  /** 目标 zip 路径 */
  targetZip: string
  /** 压缩包根目录名（缺省取文章 id） */
  name?: string
}

export interface ExportArticleZipResult {
  /** 打包的图片数量 */
  assets: number
}

/**
 * 导出文章（含引用的本地图片）为 zip 压缩包。
 * 暂存成 {name}/drafts/xxx.md + {name}/assets/y.png 结构后压缩，md 内 ../assets/xxx.png
 * 相对引用在解压后依然有效。图片逃出项目根 / 不存在的跳过。
 */
export const exportArticleZip = async (
  options: ExportArticleZipOptions
): Promise<ExportArticleZipResult> => {
  const { root, articleFile, targetZip, name } = options
  const srcMd = window.preload.path.join(root, articleFile)
  if (!window.preload.fs.existsSync(srcMd)) {
    throw new Error(`文章文件不存在：${srcMd}`)
  }
  const mdDir = window.preload.path.dirname(srcMd)
  const mdText = await window.preload.fs.readTextFile(srcMd)
  const refs = collectArticleAssets(mdText, mdDir)

  const folder = name?.trim() || window.preload.path.basename(articleFile, '.md')
  const tmpRoot = window.preload.path.join(
    window.preload.inject.os.getPath('temp'),
    folder.replace(/[/\\:*?"<>|]/g, '_')
  )
  await window.preload.fs.rm(tmpRoot)
  try {
    const stagedMd = window.preload.path.join(tmpRoot, articleFile)
    await window.preload.fs.mkdir(window.preload.path.dirname(stagedMd))
    await window.preload.fs.copyFile(srcMd, stagedMd)

    const stagedAssets = window.preload.path.join(tmpRoot, 'assets')
    await window.preload.fs.mkdir(stagedAssets)
    let count = 0
    for (const ref of refs) {
      if (!window.preload.fs.existsSync(ref.absPath)) continue
      if (!relToRoot(root, ref.absPath)) continue
      await window.preload.fs.copyFile(
        ref.absPath,
        window.preload.path.join(stagedAssets, window.preload.path.basename(ref.absPath))
      )
      count++
    }

    await window.preload.zip.compress(targetZip, [tmpRoot])
    return { assets: count }
  } finally {
    await window.preload.fs.rm(tmpRoot)
  }
}
