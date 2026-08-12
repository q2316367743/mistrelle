import { mergeAttributes } from '@tiptap/core'
import Image, { type ImageOptions } from '@tiptap/extension-image'
import { resolveNoteImage } from '@/modules/note'

export interface NoteImageOptions extends ImageOptions {
  /** md 所在目录（相对路径图片解析基准，随笔记切换重挂载注入） */
  baseDir: string
}

/**
 * 笔记图片节点：src 属性存储相对路径（源真相，序列化回 markdown 时原样保留
 * a.assets/xxx.png），仅渲染时把相对路径解析为 file:// 显示。
 */
export const NoteImage = Image.extend<NoteImageOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      baseDir: ''
    } as NoteImageOptions
  },
  renderHTML({ HTMLAttributes }) {
    const src = typeof HTMLAttributes.src === 'string' ? HTMLAttributes.src : ''
    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, {
        ...HTMLAttributes,
        src: resolveNoteImage(this.options.baseDir, src)
      })
    ]
  }
})
