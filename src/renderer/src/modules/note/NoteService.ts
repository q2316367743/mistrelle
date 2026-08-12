import { buildProjectNoteDirPath } from '@/modules/project'
import type { NoteNode } from './NoteTypes'

/**
 * 项目笔记服务：笔记是项目的一个模块，数据根目录为
 * ~/.mistrelle/project/{projectId}/notes（见 entity/project 目录结构注释）。
 * 支持文件夹嵌套，附件规范沿用 Obsidian 事实标准：笔记 a.md 的附件放在同级 a.assets/ 目录，
 * 正文内图片一律使用相对路径引用（a.assets/xxx.png，相对 md 所在目录）。
 * 因此移动 / 复制笔记时附件目录一并移动、引用天然有效；仅重命名（basename 变化）
 * 需要同步重命名 .assets 目录并改写正文内的引用。
 *
 * 所有路径相关函数以 notes 根目录（root）为首参，root 由调用方经 noteRootPath(projectId) 获得。
 */

export const NOTE_MD_EXT = '.md'
export const NOTE_ASSETS_SUFFIX = '.assets'

const INVALID_CHARS = /[\\/:*?"<>|]/

/** 正则转义，用于按字面量拼接引用改写正则 */
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** key 拆段，过滤空串 */
const splitKey = (key: string): string[] => key.split('/').filter(Boolean)

/** key 的最后一段（笔记名 / 文件夹名） */
const basenameOf = (key: string): string => splitKey(key).pop() ?? ''

/** key 的父目录相对路径（根目录为 ''） */
const dirOf = (key: string): string => {
  const parts = splitKey(key)
  parts.pop()
  return parts.join('/')
}

/** 项目笔记库根目录：~/.mistrelle/project/{projectId}/notes */
export const noteRootPath = (projectId: string): string => buildProjectNoteDirPath(projectId)

/** 笔记 md 文件绝对路径（root + key 如 drafts/idea） */
export const noteKeyToAbs = (root: string, key: string): string =>
  `${window.preload.path.join(root, ...splitKey(key))}${NOTE_MD_EXT}`

/** 笔记所在目录绝对路径（相对路径图片解析基准） */
export const noteKeyDirAbs = (root: string, key: string): string =>
  window.preload.path.dirname(noteKeyToAbs(root, key))

/** 笔记附件目录绝对路径：{name}.assets（与 md 同级） */
export const noteAssetsDirAbs = (root: string, key: string): string =>
  `${window.preload.path.join(root, ...splitKey(key))}${NOTE_ASSETS_SUFFIX}`

/** 文件夹（相对根路径 rel，根为 ''）绝对路径 */
export const folderRelToAbs = (root: string, rel: string): string =>
  rel ? window.preload.path.join(root, ...rel.split('/')) : root

/** 规范化名称：去掉首尾空白与 .md 后缀 */
export const normalizeNoteName = (input: string): string =>
  input.trim().replace(/\.md$/i, '')

/** 名称校验，返回错误信息或 null；conflicts 为父目录已占用名称集合（不含自身） */
export const validateNoteName = (name: string, conflicts: string[] = []): string | null => {
  const n = name.trim()
  if (!n) return '名称不能为空'
  if (INVALID_CHARS.test(n)) return '名称不能包含以下字符：\\ / : * ? " < > |'
  if (n.startsWith('.')) return '名称不能以 . 开头'
  if (conflicts.includes(n)) return '已存在同名条目'
  return null
}

/** 文件名清洗：去掉路径分隔与非法字符，保留扩展名 */
const sanitizeFileName = (name: string): string =>
  name.replace(/[/\\:*?"<>|]/g, '_') || 'note.png'

/** 列出父目录内展示名（文件夹名 / 笔记名），跳过隐藏项与 .assets 附件目录 */
export const listSiblingNames = async (root: string, parentRel: string): Promise<string[]> => {
  const dir = folderRelToAbs(root, parentRel)
  if (!(window.preload.fs.existsSync(dir))) return []
  const items = await window.preload.fs.readDir(dir)
  const names: string[] = []
  for (const item of items) {
    if (item.name.startsWith('.')) continue
    if (item.isDirectory && item.name.endsWith(NOTE_ASSETS_SUFFIX)) continue
    const display =
      item.isFile && item.name.toLowerCase().endsWith(NOTE_MD_EXT)
        ? item.name.slice(0, -NOTE_MD_EXT.length)
        : item.name
    names.push(display)
  }
  return names
}

/** 递归扫描笔记库构建树：文件夹在前、名称排序，跳过隐藏项与 .assets 目录 */
const readDirNodes = async (dirAbs: string, parentKey: string): Promise<NoteNode[]> => {
  const items = await window.preload.fs.readDir(dirAbs)
  const folders: NoteNode[] = []
  const notes: NoteNode[] = []
  for (const item of items) {
    if (item.name.startsWith('.')) continue
    if (item.isDirectory) {
      if (item.name.endsWith(NOTE_ASSETS_SUFFIX)) continue
      const key = parentKey ? `${parentKey}/${item.name}` : item.name
      folders.push({
        type: 'folder',
        name: item.name,
        key,
        parentKey,
        path: item.path,
        size: item.size,
        mtime: item.mtime,
        children: await readDirNodes(item.path, key)
      })
    } else if (item.isFile && item.name.toLowerCase().endsWith(NOTE_MD_EXT)) {
      const name = item.name.slice(0, -NOTE_MD_EXT.length)
      const key = parentKey ? `${parentKey}/${name}` : name
      notes.push({
        type: 'note',
        name,
        key,
        parentKey,
        path: item.path,
        size: item.size,
        mtime: item.mtime
      })
    }
  }
  const byName = (a: NoteNode, b: NoteNode) => a.name.localeCompare(b.name)
  return [...folders.sort(byName), ...notes.sort(byName)]
}

/** 读取笔记库树（根不存在时自动创建） */
export const readNoteTree = async (root: string): Promise<NoteNode[]> => {
  if (!(window.preload.fs.existsSync(root))) {
    await window.preload.fs.mkdir(root)
    return []
  }
  return readDirNodes(root, '')
}

/** 新建笔记：在 parentRel 下写入 {name}.md（以一级标题模板开场） */
export const createNote = async (root: string, name: string, parentRel: string): Promise<NoteNode> => {
  const noteName = normalizeNoteName(name)
  const err = validateNoteName(noteName, await listSiblingNames(root, parentRel))
  if (err) throw new Error(err)
  const key = parentRel ? `${parentRel}/${noteName}` : noteName
  const mdPath = noteKeyToAbs(root, key)
  await window.preload.fs.writeTextFile(mdPath, `# ${noteName}\n`)
  return { type: 'note', name: noteName, key, parentKey: parentRel, path: mdPath, size: 0, mtime: Date.now() }
}

/** 新建文件夹：在 parentRel 下创建目录 */
export const createFolder = async (root: string, name: string, parentRel: string): Promise<NoteNode> => {
  const folderName = name.trim()
  const err = validateNoteName(folderName, await listSiblingNames(root, parentRel))
  if (err) throw new Error(err)
  const key = parentRel ? `${parentRel}/${folderName}` : folderName
  const abs = folderRelToAbs(root, key)
  await window.preload.fs.mkdir(abs)
  return { type: 'folder', name: folderName, key, parentKey: parentRel, path: abs, size: 0, mtime: Date.now() }
}

/** 读取笔记正文 markdown */
export const readNote = async (root: string, key: string): Promise<string> =>
  window.preload.fs.readTextFile(noteKeyToAbs(root, key))

/** 写入笔记正文 markdown */
export const writeNote = async (root: string, key: string, content: string): Promise<void> =>
  window.preload.fs.writeTextFile(noteKeyToAbs(root, key), content)

/** 改写 md 内 {oldBase}.assets/ 引用为 {newBase}.assets/（带边界防护，避免误伤 a2.assets） */
export const rewriteAssetRefs = (md: string, oldBase: string, newBase: string): string => {
  if (oldBase === newBase) return md
  const refRe = new RegExp(`(^|[^\\w-])${escapeRegExp(oldBase)}${NOTE_ASSETS_SUFFIX}/`, 'g')
  return md.replace(refRe, `$1${newBase}${NOTE_ASSETS_SUFFIX}/`)
}

/**
 * 重命名笔记（同目录内改 basename）：重命名 md 文件 + 附件目录（若存在），
 * 并改写正文内 {old}.assets/ 引用。调用方需先落盘该笔记未保存内容。
 */
export const renameNote = async (root: string, key: string, newName: string): Promise<void> => {
  const target = normalizeNoteName(newName)
  const parentRel = dirOf(key)
  const oldName = basenameOf(key)
  if (target === oldName) return
  const siblings = (await listSiblingNames(root, parentRel)).filter((n) => n !== oldName)
  const err = validateNoteName(target, siblings)
  if (err) throw new Error(err)

  const oldMd = noteKeyToAbs(root, key)
  if (!(window.preload.fs.existsSync(oldMd))) throw new Error(`笔记不存在：${key}`)
  const content = await window.preload.fs.readTextFile(oldMd)

  const newKey = parentRel ? `${parentRel}/${target}` : target
  await window.preload.fs.rename(oldMd, noteKeyToAbs(root, newKey))

  const oldAssets = noteAssetsDirAbs(root, key)
  if (window.preload.fs.existsSync(oldAssets)) {
    await window.preload.fs.rename(oldAssets, noteAssetsDirAbs(root, newKey))
  }

  const rewritten = rewriteAssetRefs(content, oldName, target)
  if (rewritten !== content) {
    await window.preload.fs.writeTextFile(noteKeyToAbs(root, newKey), rewritten)
  }
}

/** 重命名文件夹（同目录内改 basename）；内部笔记相对引用不受影响 */
export const renameFolder = async (root: string, rel: string, newName: string): Promise<void> => {
  const target = newName.trim()
  const parentRel = dirOf(rel)
  const oldName = basenameOf(rel)
  if (target === oldName) return
  const siblings = (await listSiblingNames(root, parentRel)).filter((n) => n !== oldName)
  const err = validateNoteName(target, siblings)
  if (err) throw new Error(err)

  const oldDir = folderRelToAbs(root, rel)
  if (!(window.preload.fs.existsSync(oldDir))) throw new Error(`文件夹不存在：${rel}`)
  const newRel = parentRel ? `${parentRel}/${target}` : target
  await window.preload.fs.rename(oldDir, folderRelToAbs(root, newRel))
}

/** 删除笔记：移除 md 文件与附件目录 */
export const deleteNote = async (root: string, key: string): Promise<void> => {
  const md = noteKeyToAbs(root, key)
  if (window.preload.fs.existsSync(md)) await window.preload.fs.rm(md)
  const assets = noteAssetsDirAbs(root, key)
  if (window.preload.fs.existsSync(assets)) await window.preload.fs.rm(assets)
}

/** 删除文件夹（递归） */
export const deleteFolder = async (root: string, rel: string): Promise<void> => {
  const dir = folderRelToAbs(root, rel)
  if (window.preload.fs.existsSync(dir)) await window.preload.fs.rm(dir)
}

const EXTERNAL_RE = /^(https?:|data:|file:|blob:|mailto:|#)/i

/** 是否为本地相对路径（排除外链 / 绝对路径） */
const isRelative = (src: string): boolean => {
  const trimmed = (src ?? '').trim()
  return (
    !!trimmed &&
    !EXTERNAL_RE.test(trimmed) &&
    !trimmed.startsWith('/') &&
    !/^[a-zA-Z]:[\\/]/.test(trimmed)
  )
}

/**
 * 编辑器渲染用：把节点里相对路径图片解析为 file:// 绝对链接（不改节点 src，
 * 源真相仍是相对路径，序列化回 markdown 时原样保留 a.assets/xxx.png）。
 * 非相对路径（外链 / 绝对路径）原样返回。
 */
export const resolveNoteImage = (baseDir: string, src: string): string => {
  const trimmed = (src ?? '').trim()
  if (!isRelative(trimmed)) return src
  return window.preload.net.pathToHref(window.preload.path.resolve(baseDir, trimmed))
}

/** 计算 {name}.assets 下目标文件相对 md 所在目录的引用（md 与附件目录同级） */
export const noteAssetRel = (noteName: string, assetFile: string): string =>
  `${noteName}${NOTE_ASSETS_SUFFIX}/${assetFile}`

/**
 * 保存图片到 {note}.assets/ 并返回相对引用。
 * 粘贴 / 拖入走 file（File），斜杠命令「图片」走 sourcePath（本地文件选择）。
 */
export const saveNoteImage = async (
  root: string,
  noteKey: string,
  options: { file?: File; sourcePath?: string }
): Promise<string> => {
  const assetsDir = noteAssetsDirAbs(root, noteKey)
  await window.preload.fs.mkdir(assetsDir)
  const sourceName = options.file?.name?.trim()
  const fileName = sourceName ? `${Date.now()}_${sanitizeFileName(sourceName)}` : `${Date.now()}.png`
  const targetPath = window.preload.path.join(assetsDir, fileName)
  if (options.file) {
    await window.preload.fs.writeBinaryFile(targetPath, await options.file.arrayBuffer())
  } else if (options.sourcePath) {
    await window.preload.fs.copyFile(options.sourcePath, targetPath)
  } else {
    throw new Error('缺少图片来源')
  }
  return noteAssetRel(basenameOf(noteKey), fileName)
}
