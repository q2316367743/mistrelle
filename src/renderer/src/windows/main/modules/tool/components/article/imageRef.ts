/**
 * 文章 md 图片引用处理：本地相对路径解析（编辑器显示）+ 资产复制。
 * md 内图片一律使用相对路径（如 ../assets/xxx.png，相对 md 所在目录），保证可移植。
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

/**
 * 把本地图片（绝对路径）复制进项目 assets 目录并返回绝对路径，文件名 {prefix}-{时间戳}{原扩展名}。
 * 供封面 / 插图上传与编辑器粘贴共用，统一命名避免互相覆盖。
 */
export const copyImageToAssets = async (
  assetsDir: string,
  srcPath: string,
  prefix: string
): Promise<string> => {
  const ext = window.preload.path.extname(srcPath) || '.png'
  await window.preload.fs.mkdir(assetsDir, true)
  const target = window.preload.path.join(assetsDir, `${prefix}-${Date.now()}${ext}`)
  await window.preload.fs.copyFile(srcPath, target)
  return target
}
