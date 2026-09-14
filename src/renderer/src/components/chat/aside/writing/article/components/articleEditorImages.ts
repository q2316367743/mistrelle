/**
 * 文章编辑器图片落盘与语境工具（从 ArticleEditor.vue 抽出，控制组件行数）。
 * 约定：正文内的图片节点 src 一律是**相对 md 目录**的引用路径（可移植），落盘文件在 assets/。
 */
import type { Editor } from '@tiptap/core'
import { resolveAssetRel } from '@/windows/main/modules/tool/components/article/imageRef'

/** 图片悬浮框「AI 重新生成」的起草语境 */
export interface ArticleImageContext {
  /** 图片所在顶层块的文字（据此画贴合上下文的新图） */
  blockText: string
  /** 当前选区文字（若有） */
  selection?: string
}

/** 文件名清洗：去掉路径分隔与非法字符，保留扩展名 */
const sanitizeFileName = (name: string): string => name.replace(/[/\\:*?"<>|]/g, '_') || 'image.png'

/**
 * 本地图片（粘贴 / 拖入 / 选盘）写入 assets 目录并在光标处插入节点。
 * 返回相对 md 目录的引用路径；落盘失败或缺少目录配置时返回空串。
 */
export const insertLocalImageFile = async (
  editor: Editor,
  file: File,
  assetsDir: string,
  baseDir: string
): Promise<string> => {
  if (!assetsDir || !baseDir) return ''
  const assetPath = window.preload.path.join(
    assetsDir,
    `${Date.now()}_${sanitizeFileName(file.name)}`
  )
  try {
    await window.preload.fs.mkdir(assetsDir, true)
    await window.preload.fs.writeBinaryFile(assetPath, await file.arrayBuffer())
  } catch {
    return ''
  }
  const rel = resolveAssetRel(baseDir, assetPath)
  editor
    .chain()
    .focus()
    .insertContent({ type: 'image', attrs: { src: rel, alt: '' } })
    .run()
  return rel
}

/**
 * 统计正文中引用某张图片的节点数（相对路径精确匹配）。
 * 用于「删除图片」时判断是否仍有其它节点引用，避免误从插图列表移除仍在使用的图。
 */
export const countImageRefs = (editor: Editor, rel: string): number => {
  let count = 0
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'image' && node.attrs.src === rel) count += 1
  })
  return count
}

/** 选中的图片节点信息 */
export interface SelectedImage {
  /** 顶层文档内的位置（替换 / 删除据此寻址，避免弹窗期间选区漂移） */
  pos: number
  /** 节点 src（相对 md 目录的引用路径） */
  rel: string
  /** 图片所在顶层块的文字（AI 重新生成的语境） */
  blockText: string
}

/**
 * 在**当前选区范围内**定位图片节点（点击图片时 ProseMirror 产生 NodeSelection）。
 * 未选中图片时返回 null。返回 pos 用于后续替换 / 删除，使弹窗交互不受选区变化影响。
 */
export const findSelectedImage = (editor: Editor): SelectedImage | null => {
  const { selection, doc } = editor.state
  // 用数组收集而非可空变量：赋值发生在 nodesBetween 回调内，TS 无法据此收窄可空变量类型
  const hits: Array<{ pos: number; rel: string }> = []
  doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    if (hits.length) return false
    if (node.type.name === 'image') {
      hits.push({ pos, rel: String(node.attrs.src ?? '') })
      return false
    }
    return true
  })
  const found = hits[0]
  if (!found) return null
  const block = selection.$from.node(1)
  return { pos: found.pos, rel: found.rel, blockText: block?.textContent?.trim() ?? '' }
}

/** 替换指定位置的图片 src（「换图」与「AI 重新生成」共用），并把光标落到该图片之后 */
export const replaceImageAt = (editor: Editor, pos: number, rel: string): void => {
  editor
    .chain()
    .focus()
    .command(({ tr, state }) => {
      const node = state.doc.nodeAt(pos)
      if (!node || node.type.name !== 'image') return false
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: rel })
      return true
    })
    .run()
}

/** 删除指定位置的图片节点（可 Ctrl+Z 撤销） */
export const deleteImageAt = (editor: Editor, pos: number): void => {
  editor
    .chain()
    .focus()
    .deleteRange({ from: pos, to: pos + 1 })
    .run()
}

/** 图片节点绝对路径（供复制到剪贴板等读盘场景）；非本地相对路径返回空串 */
export { resolveArticleImagePath } from '@/windows/main/modules/tool/components/article/imageRef'
